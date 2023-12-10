## Data structures descriptions

Users:使用散列（Hash）存储用户的基本信息（如用户名、电邮、电话等），键为user:{userId}。
使用列表（List）或集合（Set）存储用户的联系人ID，键为user:{userId}:contacts。

Emails:使用散列（Hash）存储邮件的相关数据（如标题、发送时间等），键为email:{emailId}。