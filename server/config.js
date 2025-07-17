/**
 * 奖品设置
 * type: 唯一标识，0是默认特别奖的占位符，其它奖品不可使用
 * count: 奖品数量
 * title: 奖品描述
 * text: 奖品标题
 * img: 图片地址
 */
const prizes = [
  {
    type: 0,            // 不要删除或修改这条占位
    count: 0,           // 特别奖的默认数量，可设为0
    text: "特别奖",
    title: "",
    img: ""
  },
  {
    type: 1,
    count: 1,
    text: "一等奖",
    title: "神秘大礼",
    img: "../img/secrit.jpg"
  },
  {
    type: 2,
    count: 2,
    text: "二等奖",
    title: "Mac Pro",
    img: "../img/mbp.jpg"
  },
  {
    type: 3,
    count: 3,
    text: "三等奖",
    title: "保温杯",
    img: "../img/huawei.png"
  }
];

/**
 * 一次抽取的奖品个数与prizes对应
 */
const EACH_COUNT = [1, 1, 5, 6, 7, 8, 9, 10];

/**
 * 卡片公司名称标识
 */
const COMPANY = "";

module.exports = {
  prizes,
  EACH_COUNT,
  COMPANY
};
