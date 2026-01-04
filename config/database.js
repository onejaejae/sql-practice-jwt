const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('sql_practice', 'sqluser', 'sqlpassword', {
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
    logging: console.log,
    define: {
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL 데이터베이스 연결 성공!');
        return sequelize;
    } catch (error) {
        console.error('데이터베이스 연결 실패:', error);
        throw error;
    }
};

module.exports = { sequelize, connectDB };