import {
  randomFurnitureAttr,
  randomHouseAttr,
  randomPersionAttr,
  randomRoomAttr,
} from "./game/api";

// const prompt = randomPersionAttr(
//   "",
//   // "一个本科刚毕业的高智商程序员, 在一家大公司工作, 有着很高的收入, 比较内向,INTJ",
//   // "一个温柔可爱的女孩子, 设计专业大三, 很乐观开朗",
//   {}
// );
// console.log(prompt);

// const prompt = randomHouseAttr("一个小屋子,两室一厅");
// console.log(prompt);

// const prompt = randomRoomAttr({
//   名称: "温馨小屋305",
//   地址: "A市幸福区晨光路7号",
//   面积: 65,
//   户型: "2室1厅1厨1卫",
//   朝向: "南",
//   描述: "一个温馨舒适的小屋，适合小家庭居住，采光良好，装修简约。",
//   房间: [],
// });
// console.log(prompt);

const prompt = randomFurnitureAttr(
  {
    名称: "温馨小屋305",
    地址: "A市幸福区晨光路7号",
    面积: 65,
    户型: "2室1厅1厨1卫",
    朝向: "南",
    描述: "一个温馨舒适的小屋，适合小家庭居住，采光良好，装修简约。",
    房间: [],
  },
  {
    房子: "温馨小屋305",
    名称: "卫生间",
    位置: "西北角",
    描述: "小型卫生间，含基本卫浴设施，布局紧凑但实用。",
    物品: [],
  }
);
console.log(prompt);
