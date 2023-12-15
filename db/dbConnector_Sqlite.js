const { MongoClient, ObjectId } = require('mongodb');
const {createClient} = require("redis");

const uri = 'mongodb://localhost:27017/';
const databaseName = 'emailManagement';
const clientMongo = new MongoClient(uri);

let clientRedis
async function loaddata() {
  try{
      clientRedis = await createClient({
          url: "redis://127.0.0.1:6379",
      })
          .on("error", (err) => console.log("Redis Client Error", err))
          .connect();
      await clientRedis.flushDb();
      console.log("Redis database flushed successfully");
      console.log("connecting to mongo");
      await clientMongo.connect();
      const emails = clientMongo.db('emailManagement').collection('email').find({});
      const users = clientMongo.db('emailManagement').collection('user').find({});
      const folders = clientMongo.db('emailManagement').collection('folders').find({});

      clientRedis.set('emailCount',0);
      // Iterate for emails
      for await (let email of emails) {
        // console.log('sent_time:', email.sent_time);
        clientRedis.incr('emailCount');
        const objectIdStr = email.id.toString();
        clientRedis.hSet('emails:'+objectIdStr, 'id', objectIdStr);
        clientRedis.hSet('emails:'+objectIdStr, 'title', email.title);
        clientRedis.hSet('emails:'+objectIdStr, 'content', email.content);
        clientRedis.hSet('emails:'+objectIdStr, 'created_time', email.created_time.toISOString());
        if (email.sent_time) {
          clientRedis.hSet('emails:'+objectIdStr, 'sent_time', email.sent_time.toISOString());
        }
        clientRedis.hSet('emails:'+objectIdStr, 'sender_id', email.sender_id.toString());
        clientRedis.hSet('emails:'+objectIdStr, 'receiver_id', email.receiver_id.toString());
        // 对于收到的邮件
        await clientRedis.lPush('inbox:' + email.receiver_id.toString(), objectIdStr);
        // 对于发送的邮件
        await clientRedis.lPush('sentemails:' + email.sender_id.toString(), objectIdStr);
      }

      // Iterate for users
      for await (let user of users) {
        clientRedis.incr('userCount');
        const objectIdStr = user.id.toString();
        clientRedis.hSet('users:'+objectIdStr, 'id', objectIdStr);
        clientRedis.hSet('users:'+objectIdStr, 'username', user.username);
        clientRedis.hSet('users:'+objectIdStr, 'email', user.email);
        clientRedis.hSet('users:'+objectIdStr, 'cellphone', user.cellphone);
        clientRedis.hSet('users:'+objectIdStr, 'address', user.address);
        clientRedis.hSet('users:'+objectIdStr, 'birthday', user.birthday);

        const contactsString = JSON.stringify(user.contacts);
        clientRedis.hSet('users:'+objectIdStr, 'contacts', contactsString);

        clientRedis.hSet('username:'+user.username, 'username', user.username);
        clientRedis.hSet('username:'+user.username, 'password', user.password);
        clientRedis.hSet('username:'+user.username, 'id', objectIdStr);
      }
      const emailcount = await clientRedis.get('emailCount');
      const usercount = await clientRedis.get('userCount');
      console.log("There were " + emailcount + " emails");
      console.log("There were " + usercount + " users");
      return "loading success";
  }
  finally {
      console.log("closing");
      await clientMongo.close();
      // await clientRedis.quit();
  }
} 

async function verifyLogin(username, password) {
  try {
    clientRedis = await createClient({
      url: "redis://127.0.0.1:6379",
      })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();


    // 从用户名映射中获取用户ID
    const user = await clientRedis.hGet('username:' + username, 'username');
    if (!user) {
        console.log('Login failed: Username not found');
        return null;
    }
    const id = await clientRedis.hGet('username:' + username, 'id');
    // 使用用户ID获取用户详细信息
    const userPassword = await clientRedis.hGet('username:' + username, 'password');
    // console.log(user);
    // console.log(userPassword);
    console.log(id);
    if (userPassword === password) {
        console.log('Login successful');
        // 返回用户详细信息或其他所需数据
        return id;
    } else {
        console.log('Login failed: Incorrect password');
        return null;
    }
  } catch (error) {
      console.error('Error verifying login:', error);
      return null;
  } finally {
      await clientRedis.quit();
  }
}

async function checkReceivedEmails(user_id) {
  try {
      await clientRedis.connect();
      // console.log(user_id);

      const inboxKey = 'inbox:' + user_id.toString();
      // console.log('Redis Key:', inboxKey);
      const emailIds = await clientRedis.lRange(inboxKey, 0, -1);
      // console.log('Email IDs:', emailIds);

      let emails = [];
      for (const id of emailIds) {
          let emailData = await clientRedis.hGetAll('emails:' + id);
          emails.push(emailData);
      }

      return emails;
  } catch (error) {
      console.error('Error finding emails:', error);
      return [];
  } finally {
      await clientRedis.quit();
  }
}



//查看已发送邮件
async function checksentemails(user_id) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const foldersCollection = db.collection("folders");
    const emailsCollection = db.collection("email");

    // 首先，根据 user_id 和 foldername 查找所有的 email_id
    const foldersQuery = { 'user_id': new ObjectId(user_id), 'foldername': 'sent' };
    const folders = await foldersCollection.find(foldersQuery).toArray();

    // 从 folders 文档中提取所有的 email_id
    const emailIds = folders.map(folder => folder.email_id);
    console.log(emailIds); // 打印查询结果

    // 然后，使用这些 email_id 查询 emails 集合
    const emailsQuery = { 'id': { $in: emailIds } };
    const emails = await emailsCollection.find(emailsQuery).toArray();
    // console.log(emails); // 打印查询结果

    return emails;
  } catch (error) {
    console.error('Error finding draft emails:', error);
  } finally {
    // 关闭数据库连接
    await client.close();
  }
}

//查看联系人
async function checkContacts(user_id) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const contactsCollection = db.collection("user");

    // 首先，根据 user_id 查找对应的contacts
    const user = await contactsCollection.findOne({ 'id': new ObjectId(user_id) });
    // console.log(user.contacts);
    if (user) {
      const contactsQuery = { 'id': { $in: user.contacts } };

      const userContactsDetails = await contactsCollection.find(contactsQuery).toArray();

      // console.log('User Contacts Details:', userContactsDetails);
      return userContactsDetails;

    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error finding draft emails:', error);
  } finally {
    // 关闭数据库连接
    await client.close();
  }
}

//查看邮件
async function findEmail(email_id) {
  const client = new MongoClient(uri);

  try {
    // 连接到 MongoDB
    await client.connect();
    const db = client.db(databaseName);
    const emailsCollection = db.collection('email');

    const email = await emailsCollection.findOne({ id: new ObjectId(email_id) });

    return email;
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}


//查看邮件
async function findEmail(email_id) {
  const client = new MongoClient(uri);

  try {
    // 连接到 MongoDB
    await client.connect();
    const db = client.db(databaseName);
    const emailsCollection = db.collection('email');

    const email = await emailsCollection.findOne({ id: new ObjectId(email_id) });

    return email;
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

async function deleteEmails(emailIds) {
  console.log(emailIds);
  const clientMongo = new MongoClient(uri);
  let successCount = 0;
  try {
      // Connect to MongoDB
      await clientMongo.connect();
      const db = clientMongo.db(databaseName);
      const collectionEmails = db.collection('email');
      const collectionMapping = db.collection('folders');

      // Connect to Redis
      clientRedis = await createClient({
          url: "redis://127.0.0.1:6379",
      }).on("error", (err) => console.log("Redis Client Error", err))
        .connect();

      // Delete records from Emails collection and Redis
      for (const emailId of emailIds) {
          console.log(emailId);

          // Delete from MongoDB
          const emailRecord = await collectionEmails.findOne({ id: new ObjectId(emailId) });
          if (emailRecord) {
              await collectionEmails.deleteOne({ id: new ObjectId(emailId) });
              await collectionMapping.deleteOne({ email_id: new ObjectId(emailId) });

              // Delete from Redis
              await clientRedis.del('emails:' + emailId);
              await clientRedis.lRem('inbox:' + emailRecord.receiver_id.toString(), 0, emailId);
              await clientRedis.lRem('sentemails:' + emailRecord.sender_id.toString(), 0, emailId);
          }
      }
      successCount = emailIds.length;
  } catch (error) {
      console.error('Error:', error);
  } finally {
      await clientMongo.close();
      await clientRedis.quit();
      console.log('Connection closed');
  }

  return successCount; // Return the number of successfully deleted emails
}


async function getReceiver(receivername) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const userCollection = db.collection("user");

    const query = { 'username': receivername };
    const receiver = await userCollection.findOne(query);

    return receiver;
  } catch (error) {
    console.error('Error finding receiver:', error);
  } finally {
    // 关闭数据库连接
    await client.close();
  }
}

//发送邮件
async function sendemail(title, sender_id, created_time, sending_time, content,  receiver_id) {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // 连接到 MongoDB
    await client.connect();
    const db = client.db(databaseName);
    const collection = db.collection('email');
    const folderscollection = db.collection('folders');

    const newObjectId = new ObjectId();

    console.log(sender_id);
    // 创建邮件文档对象
    const emailDocument = {
      id: newObjectId,
      title: title,
      sender_id: new ObjectId(sender_id), // 确保 sender_id 是 ObjectId
      created_time: new Date(created_time),
      sending_time: new Date(sending_time),
      content: content,
      receiver_id: new ObjectId(receiver_id) // 确保 receiver_id 是 ObjectId
    };

    // 插入邮件文档到 emails 集合
    const result = await collection.insertOne(emailDocument);

    const email = {
      email_id: newObjectId,
      foldername:"sent",
      user_id:new ObjectId(sender_id),
    }

    const folderresult = await folderscollection.insertOne(email);

    console.log(`Email sent with the following id: ${result.insertedId}`);
    return result.insertedId; // 返回插入的邮件 ID
  } catch (error) {
    console.error('Error sending email:', error);
  } finally {
    // 关闭数据库连接
    await client.close();
  }
}


async function updateContact(phone, address, userId) {
  const client = new MongoClient(uri);
  try {
    await client.connect();

    const db = client.db(databaseName);
    const contactsCollection = db.collection('user');

    const filter = {
      id: new ObjectId(userId),
    };

    const update = {
      $set: {
        cellphone: phone,
        address: address,
      },
    };

    const result = await contactsCollection.updateOne(filter, update);

    if (result.matchedCount === 0) {
      throw new Error('Contact not found'); // 如果没有匹配的文档，则抛出错误
    }

    console.log('Contact updated successfully');
  } finally {
    client.close();
  }
}

module.exports = {
  verifyLogin,
  checkReceivedEmails,
  // checkDrafts,
  checksentemails,
  checkContacts,
  sendemail,
  findEmail,
  loaddata,
  deleteEmails,
  getReceiver,
  updateContact,
}



// //查看草稿箱邮件
// async function checkDrafts(user_id) {
//   const client = new MongoClient(uri);

//   try {
//     await client.connect();
//     const db = client.db(databaseName);
//     const foldersCollection = db.collection("folders");
//     const emailsCollection = db.collection("email");

//     // 首先，根据 user_id 和 foldername 查找所有的 email_id
//     const foldersQuery = { 'user_id': new ObjectId(user_id), 'foldername': 'draft' };
//     const folders = await foldersCollection.find(foldersQuery).toArray();

//     // 从 folders 文档中提取所有的 email_id
//     const emailIds = folders.map(folder => folder.email_id);
//     console.log(emailIds); // 打印查询结果

//     // 然后，使用这些 email_id 查询 emails 集合
//     const emailsQuery = { 'id': { $in: emailIds } };
//     const emails = await emailsCollection.find(emailsQuery).toArray();
//     // console.log(emails); // 打印查询结果

//     return emails;
//   } catch (error) {
//     console.error('Error finding draft emails:', error);
//   } finally {
//     // 关闭数据库连接
//     await client.close();
//   }
// }