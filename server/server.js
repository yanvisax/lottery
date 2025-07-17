const express = require("express");
const opn = require("opn");
const bodyParser = require("body-parser");
const path = require("path");
const chokidar = require("chokidar");
const cfg = require("./config");

const {
  loadXML,
  loadTempData,
  writeXML,
  saveDataFile,
  shuffle,
  saveErrorDataFile
} = require("./help");

let app = express(),
  router = express.Router(),
  cwd = process.cwd(),
  dataBath = __dirname,
  port = 8090,
  curData = {},
  luckyData = {},
  errorData = [],
  defaultType = cfg.prizes[0]["type"],
  defaultPage = `default data`;

// 这里指定参数使用 JSON 格式
app.use(
  bodyParser.json({
    limit: "1mb"
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

if (process.argv.length > 2) {
  port = process.argv[2];
}

app.use(express.static(cwd));

// 请求地址为空，默认重定向到 index.html 文件
app.get("/", (req, res) => {
  res.redirect(301, "index.html");
});

// 设置跨域访问
app.all("*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", "3.2.1");
  res.header("Content-Type", "application/json;charset=utf-8");
  next();
});

// 日志中间件：记录所有 POST 请求路径
app.post("*", (req, res, next) => {
  log(`请求内容：${JSON.stringify(req.path, 2)}`);
  next();
});

// 获取之前保存的临时数据（配置、剩余用户、已中奖数据）
router.post("/getTempData", (req, res, next) => {
  getLeftUsers();
  res.json({
    cfgData: cfg,
    leftUsers: curData.leftUsers,
    luckyData: luckyData
  });
});

// 重置抽奖数据
router.post("/reset", (req, res, next) => {
  luckyData = {};
  errorData = [];
  log(`重置数据成功`);
  saveErrorDataFile(errorData);
  return saveDataFile(luckyData).then(data => {
    // NEW: Restore all users to pool for a new session
    curData.leftUsers = Object.assign([], curData.users);
    res.json({
      type: "success"
    });
  });
});

// 获取所有用户数据
router.post("/getUsers", (req, res, next) => {
  res.json(curData.users);
  log(`成功返回抽奖用户数据`);
});

// 获取奖品信息
router.post("/getPrizes", (req, res, next) => {
  // res.json(curData.prize);
  log(`成功返回奖品数据`);
});

// 保存抽奖结果数据
router.post("/saveData", (req, res, next) => {
  let data = req.body;
  setLucky(data.type, data.data)
    .then(t => {
      // NEW: Update remaining users to exclude newly drawn winners
      getLeftUsers();
      res.json({
        type: "设置成功！"
      });
      log(`保存奖品数据成功`);
    })
    .catch(data => {
      res.json({
        type: "设置失败！"
      });
      log(`保存奖品数据失败`);
    });
});

// 保存未到场人员数据
router.post("/errorData", (req, res, next) => {
  let data = req.body;
  setErrorData(data.data)
    .then(t => {
      // NEW: Update remaining users list after marking absent users
      getLeftUsers();
      res.json({
        type: "设置成功！"
      });
      log(`保存没来人员数据成功`);
    })
    .catch(data => {
      res.json({
        type: "设置失败！"
      });
      log(`保存没来人员数据失败`);
    });
});

// 导出抽奖结果到 Excel
router.post("/export", (req, res, next) => {
  let type = [1, 2, 3, 4, 5, defaultType],
    outData = [["姓名"]]; // NEW: Only include Name column (姓名) in output
  cfg.prizes.forEach(item => {
    outData.push([item.text]);
    outData = outData.concat((luckyData[item.type] || []).map(user => [user[1]]));
  });

  writeXML(outData, "/抽奖结果.xlsx")
    .then(dt => {
      // res.download('/抽奖结果.xlsx');
      res.status(200).json({
        type: "success",
        url: "抽奖结果.xlsx"
      });
      log(`导出数据成功！`);
    })
    .catch(err => {
      res.json({
        type: "error",
        error: err.error
      });
      log(`导出数据失败！`);
    });
});

// 对于匹配不到的路径或请求，返回默认页面或错误
router.all("*", (req, res) => {
  if (req.method.toLowerCase() === "get") {
    if (/\.(html|htm)/.test(req.originalUrl)) {
      res.set("Content-Type", "text/html");
      res.send(defaultPage);
    } else {
      res.status(404).end();
    }
  } else if (req.method.toLowerCase() === "post") {
    res.send(JSON.stringify({ error: "empty" }));
  }
});

// 日志输出函数
function log(text) {
  console.log(text);
  console.log("-----------------------------------------------");
}

// 记录中奖数据到内存并持久化到文件
function setLucky(type, data) {
  if (luckyData[type]) {
    luckyData[type] = luckyData[type].concat(data);
  } else {
    luckyData[type] = Array.isArray(data) ? data : [data];
  }
  return saveDataFile(luckyData);
}

// 记录未到场人员数据
function setErrorData(data) {
  errorData = errorData.concat(data);
  return saveErrorDataFile(errorData);
}

app.use(router);

// 加载初始数据
function loadData() {
  console.log("加载EXCEL数据文件");
  // 读取抽奖用户名单 Excel
  curData.users = loadXML(path.join(dataBath, "data/users.xlsx"))
    .map(row => {
      // row = [工号, 姓名, 部门]
      const id   = row[0];      // 仍用工号做唯一标识
      const name = row[1];
      return [id, name];        // 丢弃 row[2]（部门）
    });
  shuffle(curData.users);
}

// 计算并更新剩余未中奖用户列表
function getLeftUsers() {
  // 记录当前已抽取的用户（以工号或唯一 ID 标识）
  let lotteredUser = {};
  for (let key in luckyData) {
    (luckyData[key] || []).forEach(item => {
      lotteredUser[item[0]] = true;
    });
  }
  // 将未到场人员也标记为已抽取（排除在外）
  errorData.forEach(item => {
    lotteredUser[item[0]] = true;
  });
  // 过滤出尚未中奖且未标记缺席的用户
  curData.leftUsers = curData.users.filter(user => {
    return !lotteredUser[user[0]];
  });
}

// 初始化数据加载
loadData();

module.exports = {
  run: function(devPort, noOpen) {
    let openBrowser = true;
    if (process.argv.length > 3 && (process.argv[3] + "").toLowerCase() === "n") {
      openBrowser = false;
    }
    if (noOpen) {
      openBrowser = noOpen !== "n";
    }
    if (devPort) {
      port = devPort;
    }
    let server = app.listen(port, () => {
      let host = server.address().address;
      let portNum = server.address().port;
      console.log(`lottery server listening at http://${host}:${portNum}`);
      if (openBrowser) {
        opn(`http://127.0.0.1:${portNum}`);
      }
    });
  }
};
