import isPng from "is-png";
import random from "lodash-es/random.js";
import path from "path";
import sharp from "sharp";
import textToSvg from "text-to-svg";
import { fileURLToPath } from 'url';
import utils from "../../../utils.js";
import approval from "../approval/index.js";

const Approval = approval();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (Parent) => {
  /**
   * Captcha approval transport
   */
  return class ApprovalCaptcha extends (Parent || Approval) {
    /**
     * @param {object} options
     */
    constructor(options = {}) {
      super(...arguments);
      Object.assign(this, {
        decisionLevel: '75%',
        captchaShadows: 1,
        captchaLength: 6,
        captchaWidth: 240,
        captchaBackground: 'transparent',
        captchaColor: 'random'
      }, options);
    }

    /**
     * @see Approval.prototype.init
     */
    async init() {
      this.approversCount = this.captchaLength;
      this.svgHandler = await this.createSvgHandler();
      super.init.apply(this, arguments);
    }

    /**
     * Create SVG handler
     *
     * @async
     * @returns {object}
     */
    async createSvgHandler() {
      return new Promise((resolve, reject) => {
        textToSvg.load(path.join(__dirname, '/fonts/ipag.ttf'), (err, handler) => {
          if (err) {
            return reject(err);
          }

          resolve(handler);
        });
      });
    }

    /**
     * @see Approval.prototype.createInfo
     */
    async createInfo(approver) {
      const options = Object.assign({}, this, approver.info || {});
      const answer = this.createText();
      const bgImg = await this.createImage(answer, options);
      const buffer = await bgImg.toBuffer();
      return { info: buffer.toString('base64'), answer };
    }

    /**
     * @see Approval.prototype.createQuestion
     */
    async createQuestion(data, info = {}) {
      const options = Object.assign({}, this, info);
      const size = Math.floor(options.captchaWidth / this.captchaLength);
      const width = options.captchaWidth;
      const bgImg = sharp({
        create: {
          width,
          height: size,
          channels: 4,
          background: 'transparent'
        }
      });
      bgImg.png();
      let length = this.captchaLength;
      const comp = [];

      for (let i = 0; i < data.length; i++) {
        const img = sharp(Buffer.from(data[i], 'base64'));
        const count = Math.floor(length / (data.length - i));
        img.extract({ left: 0, top: 0, height: size, width: size * count });
        comp.push({
          input: await img.toBuffer(),
          left: size * (this.captchaLength - length),
          top: 0
        });
        length -= count;
      }

      bgImg.composite(comp);
      const buffer = await bgImg.toBuffer();
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    /**
     * @see Approval.prototype.checkAnswer
     */
    async checkAnswer(approver, answer, approvers) {
      let length = this.captchaLength;

      for (let i = 0; i < approvers.length; i++) {
        const address = approvers[i];
        const count = Math.floor(length / (approvers.length - i));
        const cLength = this.captchaLength - length;
        const from = String(answer).slice(cLength, cLength + count).toLowerCase();
        const to = String(approver.answer).slice(0, count).toLowerCase();

        if (address == this.node.address) {
          return from === to;
        }

        length -= count;
      }

      return false;
    }

    /**
     * Create an image
     *
     * @param {string} text
     * @param {options} options
     * @param {string} options.captchaBackground
     * @param {number} options.captchaWidth
     * @param {string} options.captchaColor
     * @returns {object}
     */
    async createImage(text, options) {
      const length = this.captchaLength;
      const bg = options.captchaBackground;
      const size = Math.floor(options.captchaWidth / length);
      const width = options.captchaWidth;
      const bgImg = sharp({
        create: {
          width,
          height: size,
          channels: 4,
          background: bg
        }
      });
      bgImg.png();
      const comp = [];
      const maxFontSize = size * 0.9;
      const minFontSize = size * 0.5;

      for (let i = 0; i < length; i++) {
        const color = (options.captchaColor == 'random') ? utils.getRandomHexColor() : options.captchaColor;
        const strokeColor = utils.invertHexColor(color);
        const fillOpacity = random(0.25, 1, true);
        const strokeOpacity = fillOpacity * 0.5;
        const strokeWidth = random(1, 1.3, true);

        for (let k = 0; k < options.captchaShadows + 1; k++) {
          const fontSize = random(minFontSize, maxFontSize);
          const dev = Math.floor(size - fontSize);
          const svg = this.svgHandler.getSVG(text[i], {
            fontSize,
            anchor: 'left top',
            attributes: {
              fill: color,
              stroke: strokeColor,
              'stroke-opacity': strokeOpacity,
              'fill-opacity': fillOpacity,
              'stroke-width': strokeWidth
            }
          });
          const txtImg = sharp(Buffer.from(svg));
          txtImg.rotate(random(-75, 75), { background: 'transparent' });
          comp.push({
            input: await txtImg.toBuffer(),
            left: size * i + random(0, dev),
            top: random(0, dev)
          });
        }
      }
      
      bgImg.composite(comp);
      return bgImg;
    }

    /**
     * Create a random captcha text
     *
     * @returns {string}
     */
    createText() {
      return [...Array(this.captchaLength)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
    }

    /**
     * @see Approval.prototype.getClientInfoSchema
     */
    getClientInfoSchema() {
      return [
        {
          type: 'object',
          props: {
            captchaWidth: {
              type: 'number',
              value: val => val >= 100 && val <= 500 && Number.isInteger(val)
            },
            captchaBackground: {
              type: 'string',
              value: val => val == 'transparent' || utils.isHexColor(val)
            },
            captchaColor: {
              type: 'string',
              value: val => val == 'random' || utils.isHexColor(val)
            }
          },
          expected: true
        },
        'undefined'
      ];
    }

    /**
     * @see Approval.prototype.getClientAnswerSchema
     */
    getClientAnswerSchema() {
      return {
        type: 'string'
      };
    }

    /**
     * @see Approval.prototype.getApproverInfoSchema
     */
    getApproverInfoSchema() {
      return {
        type: 'string',
        value: val => Buffer.byteLength(val) < 1024 * 32 && isPng(Buffer.from(val, 'base64'))
      };
    }
  };
};
