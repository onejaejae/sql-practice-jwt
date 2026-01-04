const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

// SQLite3를 Promise로 래핑하는 클래스
class Database {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        
        // 각 메서드를 Promise로 변환
        this.get = promisify(this.db.get.bind(this.db));
        this.all = promisify(this.db.all.bind(this.db));
        this.run = this._runAsync.bind(this);
        this.close = promisify(this.db.close.bind(this.db));
    }

    // db.run을 async/await 방식으로 래핑
    async _runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    // 트랜잭션 지원
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }

    async commit() {
        await this.run('COMMIT');
    }

    async rollback() {
        await this.run('ROLLBACK');
    }

    // 안전한 종료
    async safeClose() {
        try {
            await this.close();
            console.log('데이터베이스 연결이 정상적으로 종료되었습니다.');
        } catch (error) {
            console.error('데이터베이스 연결 종료 실패:', error.message);
        }
    }
}

module.exports = Database;