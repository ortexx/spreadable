import { assert } from "chai";
import fse from "fs-extra";
import path from "path";
import tools from "../tools.js";
import file from "../../src/logger/transports/file/index.js";

const LoggerFile = file();

export default function () {
  describe('LoggerConsole', function () {
    let logger;
    let folder;

    before(() => {
      folder = path.join(tools.tmpPath, 'file-logs');
    });

    describe('instance creation', function () {
      it('should create an instance', function () {
        assert.doesNotThrow(() => logger = new LoggerFile({ folder, level: 'info' }));
        logger.node = this.node;
      });
    });

    describe('.init()', function () {
      it('should not throw an exception', async function () {
        await logger.init();
      });

      it('should create the first file', async function () {
        assert.lengthOf(await fse.readdir(folder), 1);
      });
    });

    describe('.getMessageSize()', function () {
      it('should return the right size', function () {
        const prepared = logger.prepareMessage('test', 'info');
        assert.equal(logger.getMessageSize(prepared), Buffer.byteLength(prepared, 'utf8'));
      });
    });

    describe('.prepareMessage()', function () {
      it('should prepare the right message', function () {
        const message = 'test';
        const level = 'warn';
        const prepared = logger.prepareMessage(message, level);
        const json = JSON.parse(prepared);
        assert.equal(message, json.message, 'check the message');
        assert.equal(level, json.level, 'check the type');
        assert.isNotNaN(new Date(json.date).getTime(), 'check the date');
      });
    });

    describe('.info()', function () {
      it('should write nothing', async function () {
        logger.level = 'warn';
        const message = 'test info';
        const prepared = logger.prepareMessage(message, 'info');
        await logger.info(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isNotOk(content.toString().match(prepared));
      });

      it('should write the info message', async function () {
        logger.level = 'info';
        const message = 'test info';
        const prepared = logger.prepareMessage(message, 'info');
        await logger.info(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isOk(content.toString().match(prepared));
      });
    });

    describe('.warn()', function () {
      it('should write nothing', async function () {
        logger.level = 'error';
        const message = 'test warn';
        const prepared = logger.prepareMessage(message, 'warn');
        await logger.warn(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isNotOk(content.toString().match(prepared));
      });

      it('should write the warn message', async function () {
        logger.level = 'warn';
        const message = 'test warn';
        const prepared = logger.prepareMessage(message, 'warn');
        await logger.warn(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isOk(content.toString().match(prepared));
      });
    });

    describe('.error()', function () {
      it('should write nothing', async function () {
        logger.level = false;
        const message = 'test error';
        const prepared = logger.prepareMessage(message, 'error');
        await logger.error(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isNotOk(content.toString().match(prepared));
      });

      it('should write the error message', async function () {
        logger.level = 'error';
        const message = 'test error';
        const prepared = logger.prepareMessage(message, 'error');
        await logger.error(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.isOk(content.toString().match(prepared));
      });
    });

    describe('.log()', function () {
      it('should write in a new file', async function () {
        logger.level = 'info';
        const message = 'test';
        const first = logger.getLastFile();
        logger.options.fileMaxSize = first.stat.size;
        const prepared = logger.prepareMessage(message, 'info');
        await logger.info(message);
        const last = logger.getLastFile();
        const content = await fse.readFile(last.filePath);
        assert.notEqual(first.filePath, last.filePath, 'check the file');
        assert.equal(content.toString(), prepared + '\n', 'check the content');
      });

      it('should add messages in parallel', async function () {
        logger.options.fileMaxSize = '10mb';
        const messages = [];
        const p = [];
        for (let i = 1; i < 10; i++) {
          messages.push('$$' + i);
          p.push(logger.info(messages[messages.length - 1]));
        }
        await Promise.all(p);
        const last = logger.getLastFile();
        const content = (await fse.readFile(last.filePath)).toString();
        for (let i = 0; i < messages.length; i++) {
          assert.isOk(content.indexOf(messages[i]) >= 0);
        }
      });
    });

    describe('.addNewFile()', function () {
      it('should create a new file', async function () {
        const files = await fse.readdir(folder);
        const prev = logger.getLastFile();
        const file = await logger.addNewFile();
        const last = logger.getLastFile();
        assert.equal(files.length + 1, (await fse.readdir(folder)).length, 'check the count');
        assert.equal(file.index, prev.index + 1, 'check the index');
        assert.isTrue(file.filePath != prev.filePath && file.filePath == last.filePath, 'check the path');
        assert.containsAllKeys(file.stat, ['size'], 'check the stat');
      });
    });

    describe('.getLastFile()', function () {
      it('should get the last file', async function () {
        const files = await fse.readdir(folder);
        let max = 1;
        for (let i = 0; i < files.length; i++) {
          const index = parseInt(path.basename(files[i]));
          index > max && (max = index);
        }
        const first = logger.getLastFile();
        assert.equal(first.index, max, 'check before addition');
        await logger.addNewFile();
        const last = logger.getLastFile();
        assert.equal(first.index + 1, last.index, 'check after addition');
      });
    });

    describe('.normalizeFilesCount()', function () {
      before(async function () {
        await fse.emptyDir(folder);
      });

      it('should create a new file', async function () {
        await logger.normalizeFilesCount();
        const files = await fse.readdir(folder);
        assert.equal(files.length, 1);
      });

      it('should remove excess files', async function () {
        const count = logger.options.filesCount + 2;
        for (let i = 0; i < count; i++) {
          await logger.addNewFile();
        }
        await logger.normalizeFilesCount();
        const files = await fse.readdir(folder);
        assert.equal(files.length, logger.options.filesCount);
      });
    });

    describe('.deinit()', function () {
      it('should not throw an exception', async function () {
        await logger.deinit();
      });
    });

    describe('reinitialization', () => {
      it('should not throw an exception', async function () {
        await logger.init();
      });
    });

    describe('.destroy()', function () {
      it('should not throw an exception', async function () {
        await logger.destroy();
      });
      
      it('should remove the folder', async function () {
        assert.isFalse(await fse.pathExists(folder));
      });
    });
  });
}