import { assert } from "chai";
import sharp from "sharp";
import isPng from "is-png";
import captcha from "../../src/approval/transports/captcha/index.js";
import utils from "../../src/utils.js";

const ApprovalCaptcha = captcha();

export default function () {
  describe("ApprovalCaptcha", () => {
    let approval;

    describe("instance creation", function () {
      it("should create an instance", function () {
        assert.doesNotThrow(() => (approval = new ApprovalCaptcha()));
        approval.node = this.node;
      });

      it("should create the default properties", function () {
        assert.containsAllKeys(approval, [
          "captchaLength",
          "captchaWidth",
          "captchaBackground",
          "captchaColor",
        ]);
      });
    });

    describe(".init()", function () {
      it("should not throw an exception", async function () {
        await approval.init();
      });
    });

    describe(".createText()", function () {
      it("should return a random text", function () {
        const text = approval.createText();
        assert.isOk(
          typeof text == "string" && text.length == approval.captchaLength
        );
      });
    });

    describe(".createImage()", function () {
      it("should return the right image", async function () {
        const options = {
          captchaWidth: 200,
          captchaBackground: "transparent",
          captchaColor: "#000000",
        };
        const text = approval.createText();
        const img = await approval.createImage(text, options);
        const metadata = await img.metadata();
        assert.equal(metadata.width, options.captchaWidth);
      });
    });

    describe(".createInfo()", function () {
      it("should return the right info", async function () {
        const result = await approval.createInfo({ info: {} });
        const text = result.answer;
        assert.doesNotThrow(
          () => isPng(Buffer.from(result.info, "base64")),
          "check the info"
        );
        assert.isOk(
          typeof text == "string" && text.length == approval.captchaLength,
          "check the answer"
        );
      });
    });

    describe(".createQuestion()", function () {
      it("should return the right question", async function () {
        const data = [];
        
        for (let i = 0; i < 3; i++) {
          const res = await approval.createInfo({ info: {} });
          data.push(res.info);
        }

        const result = await approval.createQuestion(data, {});
        const buffer = Buffer.from(result.split(",")[1], "base64");
        assert.isTrue(isPng(buffer));
      });
    });

    describe(".checkAnswer()", function () {
      it("should return false", async function () {
        const approvers = ["localhost:1", "localhost:2", approval.node.address];
        const result = await approval.checkAnswer(
          { answer: "34" },
          "123456",
          approvers
        );
        assert.isFalse(result);
      });

      it("should return true", async function () {
        const approvers = ["localhost:1", approval.node.address, "localhost:2"];
        const result = await approval.checkAnswer(
          { answer: "34" },
          "123456",
          approvers
        );
        assert.isTrue(result);
      });
    });

    describe(".getClientInfoSchema()", function () {
      it("should throw an error", function () {
        const schema = approval.getClientInfoSchema();
        assert.throws(
          () => utils.validateSchema(schema, { captchaLength: 1 }),
          "",
          "check the unexpected value"
        );
        assert.throws(
          () => utils.validateSchema(schema, { captchaWidth: 90 }),
          "",
          'check "captchaWidth" min'
        );
        assert.throws(
          () => utils.validateSchema(schema, { captchaWidth: 1000 }),
          "",
          'check "captchaWidth" max'
        );
        assert.throws(
          () => utils.validateSchema(schema, { captchaBackground: "wrong" }),
          "",
          'check "captchaBackground"'
        );
        assert.throws(
          () => utils.validateSchema(schema, { captchaColor: "wrong" }),
          "",
          'check "captchaColor"'
        );
      });

      it("should not throw an error", function () {
        const schema = approval.getClientInfoSchema();
        assert.doesNotThrow(
          () => utils.validateSchema(schema, { captchaWidth: 200 }),
          'check "captchaWidth"'
        );
        assert.doesNotThrow(
          () =>
            utils.validateSchema(schema, { captchaBackground: "transparent" }),
          'check "captchaBackground" transparent'
        );
        assert.doesNotThrow(
          () => utils.validateSchema(schema, { captchaBackground: "#000000" }),
          'check "captchaBackground" color'
        );
        assert.doesNotThrow(
          () => utils.validateSchema(schema, { captchaColor: "random" }),
          'check "captchaColor" random'
        );
        assert.doesNotThrow(
          () => utils.validateSchema(schema, { captchaColor: "#000000" }),
          'check "captchaColor" color'
        );
      });
    });

    describe(".getClientAnswerSchema()", function () {
      it("should throw an error", function () {
        const schema = approval.getClientAnswerSchema();
        assert.throws(() => utils.validateSchema(schema, 1));
      });

      it("should not throw an error", function () {
        const schema = approval.getClientAnswerSchema();
        assert.doesNotThrow(() => utils.validateSchema(schema, "right"));
      });
    });

    describe(".getApproverInfoSchema()", function () {
      it("should throw an error", async function () {
        const schema = approval.getApproverInfoSchema();
        assert.throws(() => utils.validateSchema(schema, "wrong"));
      });

      it("should not throw an error", async function () {
        const schema = approval.getApproverInfoSchema();
        const img = sharp({
          create: {
            width: 100,
            height: 10,
            channels: 4,
            background: "transparent",
          },
        });
        img.png();
        const buffer = await img.toBuffer();
        assert.doesNotThrow(() =>
          utils.validateSchema(schema, buffer.toString("base64"))
        );
      });
    });
    
    describe(".deinit()", function () {
      it("should not throw an exception", async function () {
        await approval.deinit();
      });
    });

    describe("reinitialization", () => {
      it("should not throw an exception", async function () {
        await approval.init();
      });
    });
    
    describe(".destroy()", function () {
      it("should not throw an exception", async function () {
        await approval.destroy();
      });
    });
  });
}
