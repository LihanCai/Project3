let express = require("express");
let router = express.Router();
const { updateContact,deleteEmails,getReceiver,sendemail,checkContacts,checksentemails,findEmail, checkDrafts, checkReceivedEmails,verifyLogin } = require("../db/dbConnector_Sqlite.js");

/* GET home page. */
router.get("/", async function (req, res) {
  // const trips = await getTrips();
  // console.log("route / called - trips.length", trips.length);
  res.render("login", {currentPage: 'login'});
});

// login page
router.get('/login', function(req, res, next) {
  res.render('login', {currentPage: 'login'})
})

// main page
router.get('/main', function(req, res, next) {
  res.render('main', {currentPage: 'main'})
})

router.post('/login', async function(req, res, next) {
  // POST请求处理，验证用户名和密码
  const { username, password } = req.body;
  // 使用数据库模块进行登录验证
  const user = await verifyLogin(username, password);
  if (user) {
    // 登录成功，可以重定向到其他页面
    req.session.userId = user.id;
    // console.log(req.session.userId);
    res.redirect('/main');
  } else {
    // 登录失败，显示错误消息
    res.render('login.ejs', { error: '用户名或密码不正确' });
  }
})

// draft page
router.get('/draft', async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  const maxLength = 25;
  // console.log(userid);
  // 使用数据库模块进行登录验证
  const emails = await checkDrafts(userid);
  emails.forEach((emails) => {
    if (emails.content.length > maxLength) {
      emails.content = emails.content.substring(0, maxLength) + '...'; // 添加省略号
    }
  });
  // console.log(emails);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.render('draft', {emails: emails})
})

// sentemails page
router.get('/sentemails', async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  const maxLength = 25;
  console.log(userid);
  // 使用数据库模块进行登录验证
  const emails = await checksentemails(userid);
  emails.forEach((email) => {
    if (email.content.length > maxLength) {
      email.content = email.content.substring(0, maxLength) + '...'; // 添加省略号
    }
  });
  // console.log(emails);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.render('sentemails', {emails: emails})
})

// receivedemails page
router.get('/receivedemails', async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  const maxLength = 25;
  console.log(userid);
  // 使用数据库模块进行登录验证
  const emails = await checkReceivedEmails(userid);
  emails.forEach((email) => {
    if (email.content.length > maxLength) {
      email.content = email.content.substring(0, maxLength) + '...'; // 添加省略号
    }
  });
  // console.log(emails);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.render('receivedemails', {emails: emails})
})

// detailedemail page
router.get('/detailedemail', async function (req, res) {
  // 获取邮件的 ID
  const emailId = req.query.emailid;
  console.log(emailId);
  const email = await findEmail(emailId);

  // 使用邮件 ID 查询特定邮件的详细信息
  // 这里可以从数据库中查询或者使用您的数据模型
  // 之后，将邮件详细信息传递给邮件详细页面的模板
  res.render('detailedemail', { email: email,});
});


// writingemail page
router.get('/writingemail', function(req, res, next) {
  res.render('writingemail', {currentPage: 'writingemail'})
})

// trashemails page
router.get('/trashemails', async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  const maxLength = 25;
  console.log(userid);
  // 使用数据库模块进行登录验证
  const emails = await checktrashemails(userid);
  emails.forEach((email) => {
    if (email.content.length > maxLength) {
      email.content = email.content.substring(0, maxLength) + '...'; // 添加省略号
    }
  });
  // console.log(emails);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.render('trashemails', {emails: emails})
})

// deletedemails page
router.get('/deletedemails',async function(req, res, next) {
    // 查询用户的邮件
    const userid  = req.session.userId;
    const maxLength = 25;
    console.log(userid);
    // 使用数据库模块进行登录验证
    const emails = await checkDeletedemails(userid);
    emails.forEach((email) => {
      if (email.content.length > maxLength) {
        email.content = email.content.substring(0, maxLength) + '...'; // 添加省略号
      }
    });
    // console.log(emails);
    // 渲染邮件页面，并将邮件数据传递给视图
  res.render('deletedemails', {emails: emails})
})

// 在 index.js 中添加路由以批量删除邮件
router.post('/deleteEmails', async function(req, res, next) {
  const emailIds = req.body.emailIds; // 从请求中获取要删除的邮件ID数组
  // console.log(emailIds);
  const successCount = await deleteEmails(emailIds); // 调用批量删除邮件的函数

  if (successCount > 0) {
    res.send({ success: true, message: `${successCount} emails successfully deleted` });
  } else {
    res.send({ success: false, message: 'delete failed' });
  }
});

// folders page
router.get('/folders',async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  // 使用数据库模块进行登录验证
  const folders = await checkFolders(userid);
  // console.log(emails);
  // 渲染邮件页面，并将邮件数据传递给视图
res.render('folders', {folders: folders})
})

// contacts page
router.get('/contacts',async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  // 使用数据库模块进行登录验证
  const contacts = await checkContacts(userid);
  // console.log(contacts);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.render('contacts', {contacts: contacts})
})

// send email
router.post('/sendemail',async function(req, res, next) {
  // 查询用户的邮件
  const userid  = req.session.userId;
  // 使用数据库模块进行登录验证
  const { receiver, title, content } = req.body;
  const obj = await getReceiver(receiver);
  const receiver_id = obj.id;
  console.log(userid);
  const created_time = new Date(); // 创建邮件的时间
  const sending_time = new Date(); // 发送邮件的时间，这里假设创建和发送时间是相同的
  const email = await sendemail(title, userid, created_time, sending_time, content,  receiver_id);
  // 渲染邮件页面，并将邮件数据传递给视图
  res.json({ email: email });
})

router.post('/updateContact', async function(req, res, next) {
  try {
    const { phone, address, id } = req.body;
  
    await updateContact(phone, address, id);

    const updatedContacts = await checkContacts(id);

    // 返回 JSON 格式的响应
    res.json({ contacts: updatedContacts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;

