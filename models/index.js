const { sequelize } = require('../config/database');
const UserModel = require('./User');
const TodoModel = require('./Todo');

const User = UserModel(sequelize);
const Todo = TodoModel(sequelize);

User.hasMany(Todo, {
    foreignKey: 'userId',
    as: 'todos'
});

Todo.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

const syncDatabase = async () => {
    try {
        await sequelize.sync({ force: false });
        console.log('데이터베이스 테이블 동기화 완료!');
    } catch (error) {
        console.error('데이터베이스 동기화 실패:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    User,
    Todo,
    syncDatabase
};