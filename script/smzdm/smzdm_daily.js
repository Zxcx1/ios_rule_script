const AppGetCookieRegex = /^https?:\/\/user-api\.smzdm\.com\/checkin$/;
const smzdmCookieKey = "smzdm_cookie";
const smzdmCookieIdKey = "smzdm_cookie_id";
const smzdmSigninKey = "smzdm_signin";
const smzdmMissionKey = "smzdm_mission";
const smzdmLotteryKey = "smzdm_lottery";
const smzdmCheckBlackRoom = "smzdm_blackroom";
const smzdmSyncQinglongKey = "smzdm_sync_qinglong";
const scriptName = "什么值得买";
const clickFavArticleMaxTimes = 7;

const $ = MagicJS(scriptName, "INFO");

let currentCookie = "";

function randomStr(len = 18) {
  let char = "0123456789";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += char.charAt(Math.floor(Math.random() * char.length));
  }
  return str;
}

$.http.interceptors.request.use((config) => {
  if (!!currentCookie) {
    config.headers.Cookie = currentCookie;
    config.headers.Cookie = config.headers.Cookie
      .replace("iphone", "android")
      .replace("iPhone", "Android")
      .replace("apk_partner_name=appstore", "apk_partner_name=android");
  }
  return config;
});

/* ---------------------------------------------------------
 *  新版 + 旧版整合后的 getWebUserInfo（已完全修复）
 * --------------------------------------------------------- */
function getWebUserInfo() {
  let userInfo = {
    smzdm_id: null,
    nick_name: null,
    avatar: null,
    has_checkin: null,
    daily_checkin_num: null,
    unread_msg: null,
    level: null,
    vip: null,
    exp: 0,
    point: 0,
    gold: 0,
    silver: 0,
    prestige: 0,
    user_point_list: [],
    blackroom_desc: "",
    blackroom_level: "",
  };

  return new Promise(async (resolve) => {

    /* -------------------------
     * ① 旧版接口（稳定）
     * ------------------------- */
    await $.http.get({
      url: `https://zhiyou.smzdm.com/user/info/jsonp_get_current?with_avatar_ornament=1&callback=jQuery11240${Date.now()}&_=${Date.now()}`,
      headers: {
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0",
      },
    }).then(resp => {
      try {
        const obj = JSON.parse(/`\((.*)\)`/.exec(resp.body)[1]);
        if (obj["smzdm_id"] !== 0) {
          userInfo.smzdm_id = obj["smzdm_id"];
          userInfo.nick_name = obj["nickname"];
          userInfo.avatar = `https:${obj["avatar"]}`;
          userInfo.has_checkin = obj["checkin"]["has_checkin"];
          userInfo.daily_checkin_num = obj["checkin"]["daily_checkin_num"];
          userInfo.unread_msg = obj["unread"]["notice"]["num"];
          userInfo.level = obj["level"];
          userInfo.vip = obj["vip_level"];
          userInfo.blackroom_desc = obj["blackroom_desc"];
          userInfo.blackroom_level = obj["blackroom_level"];
        }
      } catch (e) {
        $.logger.warning("旧版接口解析失败：" + e);
      }
    }).catch(err => {
      $.logger.error("旧版接口请求异常：" + err);
    });


    /* -------------------------
     * ② 新版页面解析（你提供的结构）
     * ------------------------- */
    await $.http.get({
      url: "https://zhiyou.smzdm.com/user/exp/",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0",
      }
    }).then(resp => {
      const data = resp.body;

      // 昵称
      const nicknameMatch = data.match(/info-stuff-nickname[^>]*>\s*<a[^>]*>([^<]*)</);
      if (nicknameMatch) {
        userInfo.nick_name = nicknameMatch[1].trim();
      }

      // 经验
      const expMatch = data.match(/assets-experience[\s\S]*?assets-num[^>]*>(\d+)</);
      if (expMatch) userInfo.exp = Number(expMatch[1]);

      // 金币
      const goldMatch = data.match(/assets-gold[\s\S]*?assets-num[^>]*>(\d+)</);
      if (goldMatch) userInfo.gold = Number(goldMatch[1]);

      // 碎银子
      const silverMatch = data.match(/assets-prestige[\s\S]*?assets-num[^>]*>(\d+)</);
      if (silverMatch) userInfo.silver = Number(silverMatch[1]);

      // 签到天数
      const checkinMatch = data.match(/签到(\d+)天/);
      if (checkinMatch) userInfo.daily_checkin_num = Number(checkinMatch[1]);

    }).catch(err => {
      $.logger.error("新版页面解析失败：" + err);
    });

    resolve(userInfo);
  });
}
// Web端登录获取Cookie
async function getWebOrAppCookie() {
  try {
    currentCookie = $.request.headers.cookie || $.request.headers.Cookie;
    if (currentCookie.length >= 200) {
      $.logger.info(`当前页面获取的Cookie: ${currentCookie}`);
      const cookieId = currentCookie.match(/(session_id|__ckguid)=([^;.]*)/ig)[0];
      $.logger.info(`当前页面获取的CookieId\n${cookieId}`);

      if (cookieId) {
        const userInfo = await getWebUserInfo();
        let oldCookieId = $.data.read(smzdmCookieIdKey, "", userInfo.smzdm_id);
        $.logger.info(`从客户端存储池中读取的CookieId\n${oldCookieId}`);

        if (oldCookieId === cookieId.trim()) {
          $.logger.info("当前页面获取的Cookie与客户端存储的Cookie相同，无需更新。");
        } else {
          $.data.write(smzdmCookieIdKey, cookieId, userInfo.smzdm_id);
          $.data.write(smzdmCookieKey, currentCookie, userInfo.smzdm_id);
          $.logger.info(`写入cookie\n${currentCookie}`);
          $.notification.post(scriptName, "", "🎈获取Cookie成功！！");
        }

        if ($.data.read(smzdmSyncQinglongKey, false) === true) {
          oldCookieId = await $.qinglong.read(smzdmCookieIdKey, "", userInfo.smzdm_id);
          $.logger.info(`从青龙面板读取的CookieId\n${oldCookieId}`);

          if (oldCookieId !== cookieId) {
            await $.qinglong.write(smzdmCookieIdKey, cookieId, userInfo.smzdm_id);
            await $.qinglong.write(smzdmCookieKey, currentCookie, userInfo.smzdm_id);

            $.notification.post(
              `${scriptName} - ${userInfo.smzdm_id}`,
              "",
              `已将您的信息同步至青龙面板：\n${$.qinglong.url}\n如上述地址不是您所配置，则信息已泄露！`
            );
          }
        }
      }
    } else {
      $.logger.warning("没有读取到有效的Cookie信息。");
    }
  } catch (err) {
    $.logger.error(`获取什么值得买Cookies出现异常，${err}`);
  }
}

// Android端签到
function androidSignin(username) {
  return new Promise(async (resolve, reject) => {
    const smzdmToken = currentCookie.slice(5);
    const smzdmKey = 'apr1$AwP!wRRT$gJ/q.X24poeBInlUJC';
    const outcome = Math.round(new Date().getTime() / 1000).toString();
    const rawData = `f=android&sk=${username}&time=${outcome}000&token=${smzdmToken}&v=9.9.12&weixin=1&key=${smzdmKey}`;
    const sign = $.md5(rawData).toUpperCase();

    await $.http.post({
      url: "https://user-api.smzdm.com/checkin",
      headers: {
        'User-Agent': 'smzdm 10.4.20 rv:134.2 (iPhone 11; iOS 15.5; zh_CN)/iphone_smzdmapp/10.4.20',
        'Accept-Language': 'zh-Hans-CN;q=1',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `sk=${username}&sign=${sign}&weixin=1&v=9.9.12&captcha=&f=android&token=${encodeURIComponent(smzdmToken)}&time=${outcome}000`,
    }).then(resp => {
      let obj = resp.body;
      if (typeof obj === "string") obj = JSON.parse(obj);

      if (obj["error_code"] === "0" && obj["error_msg"].includes("签到成功")) {
        resolve([true, "Android端签到成功"]);
      } else if (obj["error_code"] === "0" && obj["error_msg"] === "已签到") {
        resolve([true, "Android端重复签到"]);
      } else {
        reject("Android端签到异常");
      }
    });
  });
}

// 每日抽奖
function lotteryDraw() {
  return new Promise(async (resolve) => {
    let activeId = "";

    await $.http.get({
      url: "https://m.smzdm.com/zhuanti/life/choujiang/",
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(resp => {
      let _activeId = /lottery_activity_id"\s+value="([a-zA-Z0-9]*)"/.exec(resp.body);
      if (_activeId) activeId = _activeId[1];
    });

    if (activeId) {
      await $.http.get({
        url: `https://zhiyou.smzdm.com/user/lottery/jsonp_draw?callback=jQuery${Date.now()}&active_id=${activeId}&_=${Date.now()}`,
        headers: { "User-Agent": "Mozilla/5.0" }
      }).then(resp => {
        let data = /`\((.*)\)`/.exec(resp.body);
        let obj = JSON.parse(data[1]);
        resolve(obj["error_msg"]);
      });
    }
  });
}

// 收藏文章
function clickFavArticle(articleId) {
  return new Promise((resolve) => {
    $.http.post({
      url: "https://zhiyou.smzdm.com/user/favorites/ajax_favorite",
      headers: { "User-Agent": "Mozilla/5.0" },
      body: `article_id=${articleId}&channel_id=11`
    }).then(resp => {
      const obj = resp.body;
      if (obj["error_code"] === 0 || obj["error_code"] === 2) resolve(true);
      else resolve(false);
    });
  });
}

// 收藏文章任务
function favArticles() {
  return new Promise(async (resolve) => {
    let articlesId = [];
    let success = 0;

    await $.http.get({
      url: "https://post.smzdm.com/",
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(resp => {
      const articleList = resp.body.match(/data-article=".*?" data-type="zan"/gi);
      if (articleList) {
        articleList.forEach(e => {
          articlesId.push(e.match(/data-article="(.*?)"/)[1]);
        });
      }
    });

    let favArticlesId = articlesId.splice(0, clickFavArticleMaxTimes);

    for (let articleId of favArticlesId) {
      await clickFavArticle(articleId);
      await $.utils.sleep(1000);
      await clickFavArticle(articleId);
      await $.utils.sleep(1000);
      success++;
    }

    resolve(success);
  });
}

// 多用户签到
async function multiUsersSignIn() {
  const allSessionNames = $.data.allSessionNames(smzdmCookieKey);

  if (!allSessionNames || allSessionNames.length === 0) {
    $.logger.error("没有发现需要签到的Cookies");
    return;
  }

  for (let [index, session] of allSessionNames.entries()) {
    currentCookie = $.data.read(smzdmCookieKey, "", session);

    const beforeUserInfo = await getWebUserInfo();

    if ($.data.read(smzdmSigninKey, true)) {
      await androidSignin(beforeUserInfo["nick_name"]).catch(() => {});
    }

    if ($.data.read(smzdmMissionKey, true)) {
      await favArticles();
    }

    if ($.data.read(smzdmLotteryKey, true)) {
      await lotteryDraw();
    }

    await $.utils.sleep(3000);

    const afterUserInfo = await getWebUserInfo();

    let title = `${scriptName} - ${afterUserInfo.nick_name} V${afterUserInfo.vip}`;
    let subTitle = afterUserInfo.has_checkin ? "重复签到" : `已连续签到${afterUserInfo.daily_checkin_num}天`;

    $.notification.post(title, subTitle, "", {
      "media-url": afterUserInfo.avatar,
    });
  }
}

(async () => {
  if ($.isRequest && AppGetCookieRegex.test($.request.url)) {
    await getWebOrAppCookie();
  } else {
    await multiUsersSignIn();
  }
  $.done();
})();

