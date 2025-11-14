const { Sequelize } = require('sequelize');

//เชื่อมต่อฐานข้อมูล PostgreSQL
const sequelize = new Sequelize(
     'FarmBridge', // อันนี้อย่าลืมลง sql ชื่อเดียวกันก่อนรัน
     'postgres', // Username เปลี่ยนตามของตัวเอง อย่าลืม
     'copy2548', // Password เปลี่ยนตามของตัวเอง อย่าลืม
     {
       host: 'localhost',
       dialect: 'postgres' 
     }
   );

module.exports = sequelize;