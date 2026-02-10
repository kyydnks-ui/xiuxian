// main.js (入口文件)
// ----------------------------------------------------------------
import { gameState, findPerson, tempRollStats } from './state.js';
import { DB, PERSONAS, FIXED_WORLD_CONFIG } from './data.js';
import { Text, INTRO_STORY } from './text.js';
import { addLog, linkName, generateName, randomInt, randomChoice, getRealmName, Logger } from './utils.js';
import { createPerson, generateRollStats } from './factory.js';
import { G_CONFIG } from './config.js';
import { 
    changeEmotion, calculateMatchScore, growAttributes, handleNPCInteractions, birthBaby, 
    checkRealmBreakthrough as logicCheckRealm, handlePersuasion, findMediator, seizeBody, handleBreakthrough, handleTravel,handleSectMission, handleMarketTrade, handleWildHunt, passTime, handleRescueAttempt // <--- 在这里加上 seizeBody
} from './logic.js';
import * as R18 from './r18.js'; // <--- 引入 R18 模块
import { 
    updateUI, openDetail, closeModal, openCharCreator, updateCreatorPreview, openInventory,
    openSettings, toggleSetting, adjustVolume, openHistory, openMap, showModal,openSoulHistory 
} from './ui.js';
import { ActionManager } from './actions.js'; 
import { LOCATIONS, getRandomLocation } from './locations.js';// <--- 新增这一行
import { History } from './history.js'; // <--- 加上这一行
// 1. 引入音频函数
import { playBGM, playSound, setBGMVolume, setSFXVolume } from './audio.js'; 
// [main.js] 工具函数：生成一对夫妻/道侣 (isPregnant决定是否自带身孕)
function createCouple(isPregnant = false) {
    // 1. 生成一男一女
    // 【修改点】直接在第5个参数传入 "男"，这样他在生成外貌时就知道自己是男的
    // createPerson 参数顺序: (isPlayer, father, mother, customGenes, fixedGender)
    let husband = createPerson(false, null, null, null, "男");
    // 注意：createPerson 内部已经会根据性别生成男名，这里不需要再手动 generateName 改名了
    // 除非你想强制刷新一下名字，否则下面这行可以去掉。为了保险先留着：
    husband.name = generateName("男"); 

    // 【修改点】同理，直接传入 "女"
    let wife = createPerson(false, null, null, null, "女");
    wife.name = generateName("女");

    // 2. 绑定夫妻关系 (后面保持不变)
    husband.spouseId = wife.id;
    wife.spouseId = husband.id;

    // 3. 【修正】设定极高的初始感情基础
    let coupleLove = randomInt(G_CONFIG.ACTIONS.MARRY.BASE_FAVOR_REQ, 100); // 夫妻间的爱意
    
    // --- 丈夫 ---
    if (!husband.isLoveAtFirstSight) {
        husband.love = 0;   
        husband.favor = randomInt(0, 10); 
    }
    husband.trust = 0;

    // --- 妻子 ---
    if (!wife.isLoveAtFirstSight) {
        wife.love = 0;
        wife.favor = randomInt(0, 10);
    }
    wife.trust = 0;

    // 【关键】只在 relationships 里设定他们彼此的深情
    husband.relationships[wife.id] = coupleLove;
    wife.relationships[husband.id] = coupleLove;

    // 4. 处理怀孕逻辑
    if (isPregnant) {
        const dCfg = G_CONFIG.DURATION;
        wife.pregnancyProgress = randomInt(2, dCfg.PREGNANCY_FULL - 1);
        wife.birthTarget = dCfg.PREGNANCY_FULL; 
        wife.childParentId = husband.id; // 孩子是老公的

        History.record(wife, 'life', `与夫君 [${husband.name}] 恩爱有加，已怀有身孕。`);
        History.record(husband, 'life', `爱妻 [${wife.name}] 已怀有身孕，每日悉心照料。`);
    } else {
        History.record(wife, 'social', `与 [${husband.name}] 结为道侣，誓言共度仙途。`);
        History.record(husband, 'social', `与 [${wife.name}] 结为道侣，誓言共度仙途。`);
    }

    // 5. 加入游戏
    gameState.npcs.push(husband);
    gameState.npcs.push(wife);
}
window.r18 = R18;
console.log("【系统】R18 模块已挂载到 window.r18");
// --- 初始化游戏 (智能生成版) ---
function initGame(stats, customAppearance = null) {
    // 监听键盘按键
window.addEventListener('keydown', (e) => {
    // 按下 ~ 键 (Backquote) 开启/关闭上帝面板
    if (e.code === 'Backquote') {
        const consoleEl = document.getElementById('dev-console');
        if (consoleEl) {
            const isHidden = consoleEl.style.display === 'none';
            consoleEl.style.display = isHidden ? 'block' : 'none';
            if (isHidden) console.log("⚠️ 上帝模式已开启，谨慎修改数据。");
        }
    }
});
    // 1. 初始化玩家
    gameState.player = createPerson(true, null, null, customAppearance);
    gameState.player.name = "云雾衡"; 
    // === 【新增位置】在此处添加家主标记 ===
    gameState.player.isMainSoul = true;   // 标记为真魂/家主
    gameState.player.generation = 1;     // 初始为第一代
    gameState.generation = 1;            // 确保全局代数同步更新
    // ====================================
    gameState.player.age = G_CONFIG.AGE.ADULT;
    gameState.player.location = "sect";
    if(stats) {
        gameState.player.power = stats.power;
        gameState.player.int = stats.int;
        gameState.player.charm = stats.charm;
    }
// 2. 注入固定 NPC (由 data.js 中的配置驱动)
    gameState.npcs = spawnFixedWorld();
    // 3. 补充随机 NPC 直到达到总人口上限 (24人)
    const TARGET_NUM = G_CONFIG.LIMIT.MAX_POPULATION;
    while (gameState.npcs.length < TARGET_NUM) {
        let roll = Math.random();
        let slotsLeft = TARGET_NUM - gameState.npcs.length;

        // 剩余位 >= 2 且 roll 中 35% 时生成随机夫妻
        if (slotsLeft >= 2 && roll < G_CONFIG.CHANCE.COUPLE_SPAWN) {
            let isPregnant = roll < G_CONFIG.CHANCE.PREGNANCY;
            createCouple(isPregnant); 
        } else {
            gameState.npcs.push(createPerson());
        }
    }

    // 4. 处理全员“一见钟情”判定
    for (let npc of gameState.npcs) {
        if (npc.isLoveAtFirstSight) {
            addLog(`【缘分】${linkName(npc)} 初见你时面色潮红，似乎被你的魅力深深吸引了。`, "#e91e63");
            History.record(npc, 'love', `初见 [${gameState.player.name}] 惊为天人。`);
        }
    }
    
    // 5. 收尾：日志、音效、UI
    addLog(`<strong>天凤重燃</strong>：你作为云家传人，正式踏入仙途。`, "#8e44ad");
    setBGMVolume(gameState.settings.bgmVolume);
    setSFXVolume(gameState.settings.sfxVolume);
   // --- 新增：接引师兄的新手引导 ---
    let guide = gameState.npcs.find(n => n.key === "GUIDE_BRO");
    if (guide) {
        // 强制确保他在场（防止随机移动跑了）
        guide.location = gameState.player.location; 
        
        // 【修改】日志里带上他的真名，同时保留“接引师兄”的称呼
        addLog(`【入门】接引师兄 ${linkName(guide)} 微笑着递给你一块身份令牌：“师妹既入我青云宗，便要勤奋修炼，不可荒废。若有修行上的难处，随时可来找我。”`, "#e67e22");
        
        if (typeof History !== 'undefined') {
            History.record(gameState.player, 'social', `初入宗门，得到了接引师兄 [${guide.name}] 的提点与关照。`);
        }
    }
    updateUI();
    playBGM();
}

function spawnFixedWorld() {
    const cfg = FIXED_WORLD_CONFIG;
    if (!cfg) return [];

    const npcMap = {};
    const results = [];
    const allTemplates = [...cfg.leaders, ...cfg.partners, ...cfg.children];

    allTemplates.forEach(d => {
   let finalGenes = null; // <--- 1. 默认设为 null (表示：没要求，请随机)
    
    if (d.app) {
        finalGenes = {}; // <--- 2. 只有当确实有 app 配置时，才创建盒子
        for (let t in d.app) {
            // --- 修复1：统一键名映射 ---
            let standardKey = t;
            if (t === 'eyes') standardKey = 'eye_shapes'; // 兼容渲染器和描述
            
            let dbKey = t;
            if (t === 'eyes') dbKey = d.gender === '女' ? 'eyes_female' : 'eyes_male';
            else if (t === 'hair_styles') dbKey = d.gender === '女' ? 'hair_styles_female' : 'hair_styles_male';
            else if (t === 'eyebrows') dbKey = d.gender === '女' ? 'eyebrows_female' : 'eyebrows_male';
            else dbKey = t;

            const sourceArray = DB.appearance[dbKey];
            const index = d.app[t];
            
            if (sourceArray && sourceArray[index]) {
                finalGenes[standardKey] = { ...sourceArray[index] }; 
            }
        }
    }

    // 注入工厂
    let n = createPerson(false, null, null, finalGenes, d.gender); 

    // --- 强制覆盖核心属性 ---
    if (d.name) n.name = d.name; // 【修改】只有配置了名字才覆盖，否则保留随机名
    n.key = d.key;               // 【新增】把身份Key(如 GUIDE_BRO)存入NPC数据，方便查找
    n.favor = d.favor ?? 0;
    n.love = d.love ?? 0;
    n.age = d.age || n.age;
    n.homeSect = d.sect || n.homeSect;
    n.location = d.location || d.sect || "sect";
    if (d.rank) n.rank = d.rank;
    // ★★★ 新增这一句：覆盖血脉浓度 ★★★
    if (d.bloodlinePurity !== undefined) {
        n.bloodlinePurity = d.bloodlinePurity;
    }
    if (d.power) n.power = d.power;
    if (d.hasPrimalYang !== undefined) {
        n.hasPrimalYang = d.hasPrimalYang;
    }
    // --- 【新增】固定 NPC 专属履历逻辑 ---
    let customStory = d.story; 
    
    if (!customStory) {
        const storyMap = {
            "莫离": "自幼便亲近云雾衡，多年来已是习惯，从未想过有一天两个人会分开。",
            "玄机仙子": "年少成名，于青云之巅枯坐甲子感悟天道，心如止水，世间情爱于她如浮云过眼。",
            "沈光行": "铁血手腕执掌沈家三十年，曾单剑平定家族内乱，目之所及，众生皆需俯首。",
            "苏竞天": "合欢宗百年难遇的天才，游走于权欲与情爱之间，众生皆为其裙下臣，却无人能入其心。",
            "陆斩风": "万剑山一介孤僻剑修，以重剑入道，余生唯剑与酒，曾于断崖处枯守一剑十年。",
            "柳英": "莫家主母，性情温婉如水，在古板严苛的家族中是唯一能令莫离感到温暖的存在。",
            "沈青": "沈家嫡系继承人，其剑法凌厉果决，颇有其母沈光行之风。",
            "沈叙": "沈家长辈，沈光行的结发道侣。多年来居于幕后辅佐家主，长相略显艳丽，但性格温润如玉。",
            "剑心": "万剑山一代剑豪，曾与陆斩风双剑合璧斩落妖王，修为深不可测，唯对剑道与道侣极度执着。"
        };
        // 尝试匹配 key 或者 name
        customStory = storyMap[d.key] || storyMap[d.name];
    }

    if (customStory) {
        n.history = [{ 
            type: 'life', 
            text: customStory, 
            desc: customStory, 
            year: 1, 
            month: 1 
        }]; 
    }

    // 修复3：深拷贝性格
    if (d.pKey && PERSONAS[d.pKey]) {
        n.personality = JSON.parse(JSON.stringify(PERSONAS[d.pKey]));
    }

    const uniqueKey = d.key || d.name;
    npcMap[uniqueKey] = n;
    results.push(n);
});

   // --- 4. 关系绑定（增强双向逻辑版） ---
allTemplates.forEach(d => {
    const me = npcMap[d.key || d.name];
    if (!me) return;

    // 绑定配偶
    if (d.spouseKey && npcMap[d.spouseKey]) {
        const spouse = npcMap[d.spouseKey];
        me.spouseId = spouse.id;
        spouse.spouseId = me.id; // 双向绑定
        
        // 强制刷新婚姻状态，让卡片不再显示单身
        //me.status = "已婚"; 
        //spouse.status = "已婚";
    }

    // 绑定父亲
    if (d.fKey && npcMap[d.fKey]) {
        me.fatherId = npcMap[d.fKey].id;
    }

    // 绑定母亲
    if (d.mKey && npcMap[d.mKey]) {
        const mother = npcMap[d.mKey];
        me.motherId = mother.id;
        
        // 确保柳英能看到子代：
        // 检查莫离的配置里是否有 mKey: "柳英" 或 mKey: "liu_ying"
    }
});

    return results;
}


// --- 下一回合 ---
// [main.js] 升级后的 nextTurn (支持漂亮弹窗 + 所有的旧逻辑)
window.nextTurn = async function() { 
    playSound('click'); 

    // 0. 死亡检查 (用新弹窗替换 alert)
    if (gameState.player.isDead) {
        await showModal("寿元耗尽", "你已经寿元耗尽，请准备夺舍或重新开始！");
        return;
    }

    // 1. --- 随机求婚逻辑 (UI升级版) ---
    if (!gameState.spouseId && !gameState.isPlayerImprisoned) {
        let suitors = gameState.npcs.filter(n => n.gender === "男" && 
            n.favor > G_CONFIG.THRESHOLD.FAVOR_PROPOSE && 
            n.love > G_CONFIG.THRESHOLD.LOVE_PROPOSE && 
            !n.isImprisoned && !n.isNemesis && n.age >= G_CONFIG.AGE.MARRIAGE);
        if (suitors.length > 0 && Math.random() < G_CONFIG.CHANCE.PROPOSAL) { 
            let suitor = randomChoice(suitors);
            let score = calculateMatchScore(gameState.player, suitor);
            if (score > G_CONFIG.THRESHOLD.MATCH_SCORE_PROPOSE) { 
                playSound('popup'); 
                
                // 【改动2】把 confirm 换成 await showModal
                // 代码会在这里暂停，直到你点击按钮
                let confirmMarry = await showModal(
                    '红鸾星动', 
                    `【求婚】<br><br><strong>${linkName(suitor)}</strong> (${suitor.personality.name}) 向你求婚！<br>他愿以十里红妆相聘，许你一生一世。<br><br>(是否接受他为道侣？)`, 
                    'confirm'
                );

                if (confirmMarry) {
                    gameState.npcs.forEach(n => n.isSpouse = false);
                    gameState.spouseId = suitor.id;
                    suitor.isSpouse = true;
                    addLog(`【喜讯】你接受了 ${linkName(suitor)} 的求婚，二人结为道侣！`, "#e91e63");
                    History.record(suitor, 'love', `鼓起勇气向 [${gameState.player.name}] 求婚成功，得偿所愿。`);
                    History.record(gameState.player, 'love', `接受了 [${suitor.name}] 的求婚，在众人的祝福中结为道侣。`);
                } else {
                    addLog(`你拒绝了 ${linkName(suitor)} 的求婚。`, "#7f8c8d");
                    History.record(suitor, 'love', `向 [${gameState.player.name}] 求婚惨遭拒绝，伤心欲绝。`);
                    changeEmotion(suitor, 'favor', G_CONFIG.CHANCE.FAVOR_REJECT);
                    changeEmotion(suitor, 'love', G_CONFIG.CHANCE.LOVE_REJECT);
                    if (suitor.personality.isCrazy) {
                        changeEmotion(suitor, 'darkness', G_CONFIG.CHANGE.DARK_CRAZY);
                        addLog(`${linkName(suitor)} 眼神阴郁，似因爱生恨...`, "#c0392b");
                    }
                }
            }
        }
    }

    // --- 仇敌刺杀逻辑 (保持你原有的逻辑不变) ---
    let enemies = gameState.npcs.filter(n => n.isNemesis);
    if (enemies.length > 0 && Math.random() < G_CONFIG.CHANCE.ASSASSINATE) {
        const aCfg = G_CONFIG.ACTIONS.ASSASSINATE;
        let assassin = randomChoice(enemies);
        addLog(`【刺杀】仇敌 ${linkName(assassin)} 偷袭了你！`, "#c0392b");
        History.record(assassin, 'battle', `趁 [${gameState.player.name}] 闭关之际发动偷袭！`);
        History.record(gameState.player, 'battle', `闭关时遭遇仇敌 [${assassin.name}] 刺杀！`);
        if (gameState.player.power > assassin.power) {
            let dmg = randomInt(aCfg.COUNTER_DMG_MIN, aCfg.COUNTER_DMG_MAX);
          assassin.power = Math.max(0, assassin.power - dmg);
            addLog(`你反手重创刺客！(敌方修为-${dmg})`, "#27ae60");
            History.record(assassin, 'battle', `刺杀失败，反被 [${gameState.player.name}] 重创。`);
            History.record(gameState.player, 'battle', `成功击退刺客 [${assassin.name}] 并将其重创。`);
            if (assassin.power <= 0) { assassin.power = 0; addLog(`${linkName(assassin)} 被你废去修为，沦为废人。`, "#c0392b"); }
        } else {
            let dmg = randomInt(aCfg.HIT_DMG_MIN, aCfg.HIT_DMG_MAX);
            gameState.player.power = Math.max(0, gameState.player.power - dmg);
            addLog(`你不慎中招！(修为-${dmg})`, "#c0392b");
            History.record(gameState.player, 'battle', `不敌刺客 [${assassin.name}]，身受重伤。`);
        }
    }

    // --- 清除月度 Buff (保持你原有的逻辑不变) ---
    if (gameState.player.buffs) {
        if (gameState.player.buffs.charm_smoke) {
            delete gameState.player.buffs.charm_smoke;
            addLog("【效果消散】迷情香燃尽，那股躁动的异香随风而逝。", "#95a5a6");
        }
    }

    // --- 基础数值增长 (保持不变) ---
    gameState.totalMonths++;
    gameState.monthlyLearned = false;
    growAttributes(gameState.player);
    gameState.npcs.forEach(n => growAttributes(n));
    gameState.children.forEach(c => growAttributes(c));

    handleNPCInteractions();
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    if (gameState.isPlayerImprisoned) {
        // 调试日志：确认代码跑到了这里
        console.log("🔥 触发囚禁逻辑检测，监禁者ID:", gameState.captorId);

        const captor = gameState.npcs.find(n => n.id === gameState.captorId);
        
        if (captor && !captor.isDead) {
            // 1. 强制弹出囚禁日志
            addLog(`【囚居】${captor.name} 步入幽暗的禁室，目光如火，将你死死锁定。`, "#7f8c8d");
            
            // 2. 强制互动 (100% 触发)
            addLog(`【囚禁】月色凄凉，${captor.name} 脱去衣衫与你强行发生关系`, "#c0392b");
            
            // 3. 怀孕判定 (复制你之前的逻辑)
            if (!captor.isPregnant && captor.gender !== gameState.player.gender) { // 加上性别判断防报错
                if (Math.random() < 0.3) {
                    captor.isPregnant = true;
                    captor.pregnancyPartnerId = gameState.player.id;
                    const dCfg = G_CONFIG.DURATION || { PREGNANCY_FULL: 10 }; // 防报错兜底
                    captor.pregnancyProgress = 1;
                    captor.birthTarget = dCfg.PREGNANCY_FULL || 9;
                    addLog(`【神迹】由于天凤血脉的逆向侵蚀，${captor.name}发现自己体内竟结出了你的生机……`, "#f1c40f");
                }
            }
           if (Math.random() < 0.3) {
             // 这里的 handleRescueAttempt 需要确保在 main.js 头部 import 进来了
             // 或者直接用 logic.js 里的导出
             handleRescueAttempt(captor);
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        // 注意：如果在 handleRescueAttempt 里已经被救出去了，
        // 下面的 captor 属性增加其实无所谓，因为下个月就不会进这个 if 了。
        // 但为了严谨，可以加个判断：
        if (gameState.isPlayerImprisoned) {
             captor.darkness = (captor.darkness || 0) + 5;
             captor.love = (captor.love || 0) + 10;
        }
        
        } 
        else {
            // 监禁者消失/死亡，自动脱困
            gameState.isPlayerImprisoned = false;
            gameState.captorId = null;
            addLog(`【脱困】禁锢你的气息消失了，你趁机逃出了地牢。`, "#2ecc71");
        }
    }
    // --- 成年逻辑 (保持不变) ---
    gameState.children.forEach(c => {
        if (c.age >= G_CONFIG.AGE.MARRIAGE) {
            let exists = gameState.npcs.some(n => n.id === c.id);
            if (!exists) {
                gameState.npcs.push(c);
                addLog(`【成年】子嗣 ${linkName(c)} 已满${G_CONFIG.AGE.MARRIAGE}岁，正式入世。`, "#2980b9");
           History.record(c, 'life', `年满 ${G_CONFIG.AGE.MARRIAGE} 岁，告别父母，正式踏入修仙界。`);
            }
        }
    });

    if (gameState.totalMonths % G_CONFIG.DURATION.YEAR_MONTHS === 1) {
        gameState.player.age++;
        gameState.npcs.forEach(n => n.age++);
        gameState.children.forEach(c => c.age++);
    }

    // 2. --- 核心 NPC 循环 (★改动3：关键修改★) ---
    // 原来的 gameState.npcs.forEach 必须改成 for...of
    // 只有这样，里面的 await birthBaby 才能生效，游戏才能在弹窗时暂停
    for (const npc of gameState.npcs) {
        if (npc.pregnancyProgress > 0) {
            
            // --- (这里是你之前添加的流产判定逻辑，我完整保留了) ---
            let isAborted = false;
            let abortReason = "";
            let damageRate = 0; 
            
            // A. 人祸
            if (npc.childParentId === gameState.player.id) {
                let isHated = npc.isNemesis || npc.favor < G_CONFIG.THRESHOLD.HATE_ABORTION;
                let abortChance = G_CONFIG.CHANCE.ABORTION_INDUCE;
                if (["清贵", "孤绝", "守心"].includes(npc.personality.name)) abortChance += 0.1;
                
                if (isHated && Math.random() < abortChance) {
                    isAborted = true;
                    abortReason = "induce"; 
                    damageRate = G_CONFIG.RATE.DMG_ABORT_INDUCE; 
                }
            }
            // B. 天灾
            if (!isAborted && Math.random() < G_CONFIG.CHANCE.ABORTION_NATURAL) {
                isAborted = true;
                abortReason = "natural";
                damageRate = G_CONFIG.RATE.DMG_ABORT_NATURAL;
            }

            if (isAborted) {
                npc.pregnancyProgress = 0; 
                npc.birthTarget = 0;
                npc.childParentId = null;

                let dmg = Math.floor(npc.power * damageRate);
                npc.power = Math.max(0, npc.power - dmg);

                if (abortReason === "induce") {
                    addLog(`【人伦惨剧】${linkName(npc)} 无法忍受腹中孽种，竟亲手以此残忍方式堕胎！(修为大损 -${dmg})`, "#c0392b");
                    History.record(npc, 'life', `因心怀怨恨，亲手扼杀了腹中胎儿，致使元气大伤。`);
                    if (gameState.settings.showBirth) {
                        addLog(`(那原本是你的骨肉...)`, "#7f8c8d");
                    }
                } else {
                    addLog(`【意外】${linkName(npc)} 不慎动了胎气，腹中胎儿不幸流失。(修为 -${dmg})`, "#95a5a6");
                    History.record(npc, 'life', `不幸遭遇意外流产，痛失爱子。`);
                }
                
                // 既然流产了，就不执行下面的逻辑，直接处理下一个NPC (continue)
                continue; 
            }
            // --- (流产逻辑结束) ---

            // 正常生长
            npc.pregnancyProgress++;
            
            let isRelevant = (npc.childParentId === gameState.player.id) || 
                             (npc.id === gameState.player.id) ||             
                             (npc.relationships[gameState.player.id] > G_CONFIG.THRESHOLD.RELATION_RELEVANT);

            if (npc.pregnancyProgress === G_CONFIG.DURATION.PREGNANCY_LOG && isRelevant) {
                addLog(`【脉象】${linkName(npc)} 已有身孕 3 个月！`, "#9b59b6");
            }

            let birthMonth = npc.birthTarget || G_CONFIG.DURATION.PREGNANCY_FULL;
            if (npc.pregnancyProgress >= birthMonth) {
                // 【改动4】这里加上 await
                // 这意味着：如果 birthBaby 里弹出了取名窗口，代码会在这里停住
                // 等你取完名字，点确定，才会继续循环下一个 NPC
                await birthBaby(npc);
            }
        }
    }

    // --- 人口流动与补充 (保持你原有的逻辑不变) ---
    if (gameState.totalMonths % G_CONFIG.DURATION.NPC_MOVE_INTERVAL === 0) {
        let moveCount = 0;
        gameState.npcs.forEach(npc => {
            if (npc.isDead || npc.isImprisoned || npc.pregnancyProgress > 0) return;
            if (Math.random() < G_CONFIG.CHANCE.NPC_MOVE) {
                let oldLoc = npc.location;
                // 注意：确保 getRandomLocation 在上面 import 了或者之前就是全局可用的
                if (typeof getRandomLocation === 'function') {
                     let newLoc = getRandomLocation(); 
                    if (newLoc !== oldLoc) {
                        npc.location = newLoc;
                        moveCount++;
                    }
                }
            }
        });
    }

    const MAX_POPULATION = G_CONFIG.LIMIT.MAX_POPULATION; 
    let livingNpcs = gameState.npcs.filter(n => !n.isDead).length;

    if (livingNpcs < MAX_POPULATION) {
        let slots = Math.min(G_CONFIG.LIMIT.SPAWN_PER_TURN, MAX_POPULATION - livingNpcs);
        for (let i = 0; i < slots; i++) {
            let npc = createPerson();
            gameState.npcs.push(npc);
            if (npc.isLoveAtFirstSight && !npc.isDead) {
                 addLog(`【新面孔】${linkName(npc)} 踏入修仙界，初见你时便羞红了脸。`, "#e91e63");
                 History.record(npc, 'love', `初入江湖，便对 [${gameState.player.name}] 一见钟情。`);
            }
        }
    }
if (window.R18 && window.R18.checkNightAttack && gameState.settings.enableR18) {
        // 只有玩家没被囚禁的时候才会被夜袭 (不然逻辑冲突)
        if (!gameState.isPlayerImprisoned) {
            // 使用 setTimeout 延迟一点点弹出，避免和上面的日志/怀孕弹窗冲突
            setTimeout(() => {
                let visitor = window.R18.checkNightAttack();
                if (visitor) {
                    if(window.playSound) window.playSound('popup'); 
                    window.showNightAttackModal(visitor);
                }
            }, 800); // 延迟 0.8 秒，体验更好
        }
    }
    // --- 结尾 UI 刷新 (保持不变) ---
    addLog(`=== ${Math.ceil(gameState.totalMonths/G_CONFIG.DURATION.YEAR_MONTHS)}年${(gameState.totalMonths-1)%G_CONFIG.DURATION.YEAR_MONTHS+1}月 ===`);
    updateUI();
    let modal = document.getElementById('detailModal');
    if(modal && modal.style.display === 'flex') openDetail(gameState.selectedPersonId); 
    
    if (gameState.player.isDead) {
        // 死亡提示也稍微美化一下，加个小延时确保UI刷新
        await new Promise(r => setTimeout(r, r, G_CONFIG.DURATION.UI_DELAY));
        await showModal("道消身死", "大限已至，你的肉身机能彻底停止。<br><br>(膝下无女，香火已断，游戏彻底结束)");
    }
}

// --- 动作系统 ---
// main.js - 动作系统部分

function action(type, targetId) {
    // 【关键修改】如果传了 targetId（来自新窗口按钮），就优先用它
    // 如果没传（比如键盘快捷键），才用默认选中的人
    let id = targetId || gameState.selectedPersonId;
    let person = findPerson(id);

    // 1. 安全检查
    if (!person) {
        console.warn("Action failed: No person selected.");
        return;
    }

    // 2. 尝试使用新系统执行动作
    // 如果 ActionManager 找到了这个动作(type)，它会负责扣除精力、执行逻辑并刷新UI
    let handled = ActionManager.run(type, person);

    // 3. 如果没找到，说明出bug了或者有漏网之鱼
    if (!handled) {
        console.error(`未知的动作类型: ${type}`);
    }
}

function useItem(index) {
    let itemName = gameState.player.items[index];
    let itemDef = DB.items.find(i => i.name === itemName);
    gameState.player.items.splice(index, 1);
    
    if (itemDef) {
        let log = "";
        let effectParts = itemDef.effect.split("+");
        let type = effectParts[0];
        let val = parseInt(effectParts[1] || 0);

        if(type === "power") { 
            gameState.player.power += val; 
            log = Text.Logs.itemUsed(itemName, '修为', val); 
        }
        else if(type === "charm") { 
            gameState.player.charm += val; 
            log = Text.Logs.itemUsed(itemName, '魅力', val); 
        }
        else if(type === "int") { 
            gameState.player.int += val; 
            log = Text.Logs.itemUsed(itemName, '智力', val); 
        }
        else if(type === "favor" || type === "love") { 
            gameState.player.charm += val; 
            log = `你使用了 [${itemName}]，感觉自己变得更迷人了。(魅力+${val})`;
        }
        else { log = Text.Logs.itemUsed(itemName, 'none', 0); }
        
        addLog(log, "#27ae60");
        logicCheckRealm(gameState.player); 
    }
    openInventory(); 
    updateUI();
}

function saveGame() {
    try {
        localStorage.setItem('xiuxian_save_v24', JSON.stringify(gameState));
        addLog(Text.Logs.saveSuccess, "#27ae60");
    } catch(e) { alert("存档失败"); }
}

function loadGame(isStartScreen = false) {
    try {
        const data = localStorage.getItem('xiuxian_save_v24');
        if (!data) {
            if(isStartScreen) alert("没有存档！");
            else addLog(Text.Logs.noSave, "#c0392b");
            return;
        }
        
        let loaded = JSON.parse(data);
        
        // 1. 基础覆盖
        Object.assign(gameState, loaded); 

        // ================================================
        // 🛠️ 关键修复：新系统数据补全 (防止旧存档崩坏)
        // ================================================
        
        // A. 补全玩家技能 (V0.70 新增)
        if (!gameState.player.skills) {
            gameState.player.skills = {}; // 如果完全没有，初始化为空对象
        }
        // 确保每个技能都有默认值，防止 undefined
        const defaultSkills = ['gathering', 'hunting', 'alchemy', 'forging', 'secret_arts'];
        defaultSkills.forEach(skillKey => {
            if (!gameState.player.skills[skillKey]) {
                gameState.player.skills[skillKey] = { level: 0, exp: 0 };
            }
        });

        // B. 补全玩家背包 (防止旧存档没有 items 字段，虽然一般都有)
        if (!gameState.player.items) {
            gameState.player.items = [];
        }

        // C. 补全配置项 (防止新加的音量设置丢失)
        if (!gameState.settings) gameState.settings = {};
        if (gameState.settings.bgmVolume === undefined) gameState.settings.bgmVolume = 0.4;
        if (gameState.settings.sfxVolume === undefined) gameState.settings.sfxVolume = 0.6;
        
        // D. 补全已解锁地点 (防止旧存档读出来地图是锁的)
        if (!gameState.unlockedLocations) {
            gameState.unlockedLocations = ['sect', 'market', 'wild'];
        }

        // ================================================

        // 2. 确保玩家有位置
        if (!gameState.player.location) {
            gameState.player.location = "sect";
        }

        // 3. 兼容性补丁：升级旧版性格数据 (保留你原有的逻辑)
        if (gameState.npcs) {
            gameState.npcs.forEach(npc => {
                if (!npc.personality || !npc.personality.key) {
                    // console.log(`正在升级 NPC [${npc.name}] 的性格数据...`);
                    // 确保 generatePersonality 可用，如果报错请检查 import
                    if (window.generatePersonality) {
                        npc.personality = window.generatePersonality(npc.gender);
                    }
                }
            });
        }

        // 4. 确保孩子也有位置
        if (gameState.children) {
            gameState.children.forEach(c => {
                if (!c.location) c.location = "sect";
            });
        }
      
        // 5. 应用设置
        if (window.setBGMVolume) setBGMVolume(gameState.settings.bgmVolume);
        if (window.setSFXVolume) setSFXVolume(gameState.settings.sfxVolume);
        
        if(isStartScreen) document.getElementById('startScreen').style.display = 'none';
        
        // 播放BGM
        if (gameState.settings.enableBGM && window.playBGM) window.playBGM();
        
        // 刷新界面
        if (window.updateUI) window.updateUI();
        if (window.addLog) addLog(Text.Logs.loadSuccess, "#2980b9");
        
    } catch(e) { 
        console.error("读档报错:", e); 
        alert("存档已损坏或版本不兼容，建议重置游戏。"); 
    }
}
function exportSave() {
    const data = localStorage.getItem('xiuxian_save_v24');
    if (!data) return alert("当前没有存档可导出！请先保存游戏。");
    const saveCode = btoa(encodeURIComponent(data));
    
    // 如果有 showModal 就用，没有就用 prompt
    if (window.showModal) {
        window.showModal("导出存档", 
            `<p>请复制下方代码保存到本地文本中：</p><textarea style="width:100%; height:150px; font-size:12px;">${saveCode}</textarea>`,
            "alert"
        );
    } else {
        prompt("请复制存档代码:", saveCode);
    }
}

// 4. 导入存档
async function importSave() {
    let code = "";
    if (window.showInput) {
        code = await window.showInput("请粘贴存档代码：", "", "导入存档");
    } else {
        code = prompt("请粘贴存档代码：");
    }
    
    if (!code) return;

    try {
        const jsonStr = decodeURIComponent(atob(code));
        const testParse = JSON.parse(jsonStr); 
        if (testParse && testParse.player) {
            localStorage.setItem('xiuxian_save_v24', jsonStr);
            alert("导入成功！即将读取...");
            loadGame(false); 
        } else {
            alert("无效的存档代码！");
        }
    } catch (e) {
        alert("解析失败，请确认代码完整。");
        console.error(e);
    }
}


const lockState = {
    power: false,
    int: false,
    charm: false
};

// 暴露给 window 以便 HTML 点击调用
window.toggleLock = function(attr) {
    // 1. 切换状态
    lockState[attr] = !lockState[attr];
    const isLocked = lockState[attr];

    // 2. 更新 UI (锁图标和透明度)
    // 首字母大写处理: 'power' -> 'Power'
    const capitalAttr = attr.charAt(0).toUpperCase() + attr.slice(1);
    const el = document.getElementById(`lock${capitalAttr}`);
    
    if (el) {
        el.innerText = isLocked ? "🔒" : "🔓";
        el.style.opacity = isLocked ? "1.0" : "0.3"; // 锁定时高亮，未锁半透明
        el.style.color = isLocked ? "#e74c3c" : "inherit"; // 锁定时变红
    }
    
    // 播放音效
    if(window.playSound) window.playSound('click');
};

// --- ★ 修改：Roll 点逻辑 ---
window.rollStats = function() { // 确保挂在 window 上，或者原本的 export
    if(window.playSound) window.playSound('roll'); // 假设有个 roll 音效，没有就用 click

    // 1. 生成一套全新的随机数值 (引用 factory.js 的生成器)
    let newStats = generateRollStats();

    // 2. 只有【未锁定】的属性才更新
    if (!lockState.power) tempRollStats.power = newStats.power;
    if (!lockState.int)   tempRollStats.int   = newStats.int;
    if (!lockState.charm) tempRollStats.charm = newStats.charm;

    // 3. 更新界面显示
    const powerEl = document.getElementById('rollPower');
    const intEl = document.getElementById('rollInt');
    const charmEl = document.getElementById('rollCharm');

    // 加上简单的动画效果 (可选)
    if (!lockState.power) animateValue(powerEl, tempRollStats.power);
    if (!lockState.int)   animateValue(intEl, tempRollStats.int);
    if (!lockState.charm) animateValue(charmEl, tempRollStats.charm);
}

// 辅助：简单的数字跳动动画 (让 Roll 点更有感觉)
function animateValue(obj, end, duration = 300) {
    if (!obj) return;
    let startTimestamp = null;
    const start = parseInt(obj.innerText) || 0;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}
window.rollStats = rollStats;
// [main.js] 修改后的 finishCreator 函数
function finishCreator() {
    const keys = ['skins', 'hair_colors', 'hair_styles', 'eye_colors', 'eyebrows', 'eye_shapes', 'face_shapes', 'noses', 'lips', 'decorations', 'temperaments'];
    let customAppearance = {};
    let totalScore = 0;

    keys.forEach(key => {
        let select = document.getElementById(`sel_${key}`);
        // 🔍 修改重点：增加 (select.value) 非空检查
        if(select && select.value) {
            try {
                let item = JSON.parse(select.value);
                customAppearance[key] = item;
                totalScore += item.score;
            } catch (e) {
                // 如果出错，只在控制台打印，不再让游戏崩溃
                console.warn(`跳过无效选项: ${key}`, e);
            }
        }
    });
    // 如果没有计算出分数，给个默认值防止后续出错
    customAppearance.beautyScore = totalScore || 0;

    // 隐藏界面并开始游戏
    let creator = document.getElementById('charCreator');
    if (creator) creator.style.display = 'none';
    
    // 这里传入的数据必须确保正确，否则 initGame 也会错
    initGame(tempRollStats, customAppearance);
}

// --- 3. 挂载到 Window ---
window.initGame = initGame;
window.nextTurn = nextTurn;
window.openDetail = openDetail;
window.closeModal = closeModal;
window.action = action;
window.saveGame = saveGame;
window.loadGame = loadGame;
window.exportSave = exportSave;
window.importSave = importSave;
window.rollStats = rollStats;
window.startGame = openCharCreator;
window.useItem = useItem;
window.openInventory = openInventory;
window.openCharCreator = openCharCreator;
window.finishCreator = finishCreator;
window.openPlayerDetail = () => openDetail(gameState.player.id);
window.updateCreatorPreview = updateCreatorPreview;
window.openSettings = openSettings; 
window.toggleSetting = toggleSetting;
// 4. 暴露 playSound 供 HTML 使用
window.playSound = playSound;
window.adjustVolume = adjustVolume;
window.gameState = gameState;
window.updateUI = updateUI;

// --- 夺舍入口 ---
window.attemptSeize = function(childId) {
    const child = gameState.children.find(c => c.id === childId);
    if (!child) return;

    // 1. 确认弹窗
    const confirmMsg = `【⚠ 夺舍警告】\n\n你即将夺舍子嗣 [${child.name}] (资质: ${child.power}/魅力: ${child.charm})。\n\n代价如下：\n1. 你的【修为】将彻底消失，需从 [${getRealmName(child.power)}] 重新修炼。\n2. 你的【人际关系】(丈夫/仇敌) 将全部重置。\n3. 仅保留【背包物品】。\n\n确定要抛弃旧肉身，借尸还魂吗？`;
    
    if (confirm(confirmMsg)) {
        const success = seizeBody(childId);
        if (success) {
            playSound('popup'); // 成功音效
            closeModal();       // 关闭详情窗
            
            // 如果之前是因为死了才夺舍的，现在要复活
            // 虽然 logic.js 里的 seizeBody 切换了 player 对象，新对象肯定没死
            // 但为了保险，强制刷新一下 UI
            updateUI(); 
            
            // 视觉反馈：提示新生活开始
            alert(`夺舍成功！\n你现在的身份是：${gameState.player.name}\n请开始你的第二世修仙路！`);
        }
    }
};
// 启动
// 启动
// ▼▼▼ 【插入测试代码】 ▼▼▼
console.log("--------------------------------");
if (window.Logger) {
    Logger.info("System", "第一阶段基础设施建设完成！");
} else {
    console.log("Logger 尚未挂载到 window，尝试直接使用 import 的 Logger");
    // 因为 main.js 里已经 import 了 Logger，直接用即可
    Logger.info("System", "第一阶段基础设施建设完成！");
}
console.log("测试读取配置 - 成年岁数:", G_CONFIG.AGE.ADULT);
console.log("--------------------------------");
// ▲▲▲ 插入结束 ▲▲▲

rollStats();

// --- 突破按钮点击事件 ---
window.clickBreakthrough = async function() {
    let p = gameState.player;
    
    // 简单预测一下概率给玩家看 (和 logic 里的算法保持一致)
    let baseChance = G_CONFIG.BREAKTHROUGH.BASE_CHANCE;
    let intBonus = p.int * G_CONFIG.BREAKTHROUGH.INT_BONUS;
    let estimate = Math.min(G_CONFIG.BREAKTHROUGH.MAX_CHANCE, baseChance + intBonus);
    
    // 如果是元婴圆满，提示有死亡风险
    let warning = "";
    if (getRealmName(p.power) === "元婴圆满") {
        estimate = G_CONFIG.BREAKTHROUGH.DANGER_BASE + (p.int * G_CONFIG.BREAKTHROUGH.DANGER_INT_BONUS); // 修正显示的概率
        warning = "\n\n⚠️【极度危险】此乃化神天劫，失败将直接身死道消！";
    }

   // 3. 弹窗确认 (使用 showModal 替代 confirm)
    let confirmMsg = `【境界突破】<br><br>当前境界：<strong>${getRealmName(p.power)}</strong><br>预估成功率：<span style='color:#2980b9; font-weight:bold; font-size:18px;'>约 ${estimate.toFixed(0)}%</span>${warning}<br><br>(是否尝试强行冲关？)`;
    
    let doBreak = await showModal("境界突破", confirmMsg, 'confirm');
    
    if (doBreak) {
        let result = handleBreakthrough(p);
        
        if (result.success) {
            playSound('popup');
            addLog(`【大喜】${result.msg}`, "#e91e63");
        } else {
            // 失败分支
            if (result.isDead) {
                // --- 玩家死了 ---
                playSound('click'); 
                // 使用 showModal 替代 alert
                await showModal("道消身死", result.msg);
                
                // 刷新 UI 触发死亡逻辑
                updateUI();
                return;
            }

            playSound('click');
            addLog(`【遗憾】${result.msg}`, "#7f8c8d");
        }
        
        updateUI();
    }
};
// 挂载移动函数
window.handleTravel = function(targetId) {
    if (gameState.player.location === targetId) return;

    // 二次确认
    if (confirm(`确定要前往目标地点吗？路途将消耗数月时间。`)) {
        let success = handleTravel(targetId);
        if (success) {
            updateUI(); // 移动完刷新界面
            window.closeModal(); // 如果有弹窗，关闭它
        }
    }
};
window.openMap = openMap;
// 1. 把“私有”的 openHistory 变成“公开”的，这样 HTML 才能用
window.openHistory = openHistory; 

// 2. 加一句打印，证明代码跑通了 (打开控制台看有没有这就行)
console.log("✅ 履历功能已挂载！openHistory is ready:", window.openHistory);
// 挂载场景特色功能
window.handleSectMission = function() {
    if(handleSectMission()) updateUI();
};
window.handleMarketTrade = function() {
    if(handleMarketTrade()) updateUI();
};
window.handleWildHunt = function() {
    if(handleWildHunt()) updateUI();
};
// main.js 末尾新增

// 使用物品逻辑
// [main.js] 修改后的物品使用逻辑 (支持 Buff)
window.useItem = function(index) {
    const p = gameState.player;
    let itemName = p.items[index];
    if (!itemName) return;

    if(window.playSound) window.playSound('click');

    // 🛡️ 确保 player.buffs 存在
    if (!p.buffs) p.buffs = {};

    let consumed = false;
    let msg = "";

    // --- 物品效果分支 ---
    if (itemName === "受孕丹") {
        p.buffs.next_sure = true; // 设置 Buff 标记
        msg = "你服下了【受孕丹】。腹中升起一股暖流，<span style='color:#e91e63'>下一次双修必中！</span>";
        consumed = true;
    }
    else if (itemName === "多子丸") {
        p.buffs.next_multi = true;
        msg = "你服下了【多子丸】。感觉身体发生了一些奇妙的变化，<span style='color:#9b59b6'>若怀孕必为多胞胎！</span>";
        consumed = true;
    }
    // === 补充：炼丹产出的极品丹药 ===
    
    // 1. 麒麟送子丹 (多子丸的极品版)
    else if (itemName === "麒麟送子丹") {
        p.buffs.next_multi = true; // 同样赋予多胞胎Buff
        // 额外奖励：因为是极品，吃下去顺便补满精力，或者加点魅力
        p.charm += 2; 
        msg = "你服下了传说中的【麒麟送子丹】！<br>祥瑞入体，<span style='color:#e74c3c'>必生多胞胎</span>，且容光焕发(魅力+2)！";
        consumed = true;
    }

    else if (itemName === "迷情香") {
        p.buffs.charm_smoke = true;
        msg = "你点燃了【迷情香】。异香缭绕，<span style='color:#c0392b'>解锁【强行春宵】互动！</span>(持续至本月结束)";
        consumed = true;
    }
    // ... 保留原有的聚气丹等逻辑 ...
    else if (itemName === "聚气丹") {
        let luckBonus = (p.luck || 1) * 0.5; 
        let effect = 30 + Math.floor(Math.random() * 20) + Math.floor(luckBonus);
        p.power += effect;
        msg = `你服用了【${itemName}】，修为 +${effect}`;
        consumed = true;
    } 
     // 2. 极品聚气丹 (聚气丹的极品版)
    else if (itemName === "极品聚气丹") {
        // 普通聚气丹可能加 50，极品加 150
        let gain = 150 + p.int; 
        p.power += gain;
        msg = `你服下了【极品聚气丹】，药力澎湃！修为暴涨 <span style='color:#2ecc71'>+${gain}</span>`;
        consumed = true;
    }
    else if (itemName === "驻颜丹") {
        p.charm += 10;
        msg = `你服用了【${itemName}】，皮肤如婴儿般嫩滑。魅力 +10`;
        consumed = true;
    }
     // 3. 极品驻颜丹 (驻颜丹的极品版)
    else if (itemName === "极品驻颜丹") {
        p.charm += 5; // 普通可能加2，极品加5
        // 甚至可以回春（减年龄），看你想不想加
        if(p.age > 18) p.age -= 1; 
        msg = "你服下了【极品驻颜丹】，时光倒流！<br>魅力 <span style='color:#e91e63'>+5</span>，仿佛年轻了一岁！";
        consumed = true;
    }

    else {
        // 未知物品
        window.showAlert(`这东西 [${itemName}] 看起来不能直接用。`, "提示");
        return;
    }

    // --- 结算 ---
    if (consumed) {
        p.items.splice(index, 1); // 移除物品
        updateUI(); // 刷新界面
        window.closeModal(); // 关闭背包
        
        // 使用新弹窗提示效果
        window.showAlert(msg, "物品使用");
    }
};
window.buyItem = function(itemName, price) {
    const p = gameState.player;
    
    // 1. 检查余额
    if ((p.spiritStones || 0) < price) {
        window.showAlert(`灵石不足！<br>需要 <span style="color:#e67e22">${price}</span> 灵石，你只有 ${p.spiritStones || 0}。`, "购买失败");
        return;
    }

    // 2. 扣钱并加物品
    p.spiritStones -= price;
    p.items.push(itemName);
    
    // 3. 播放音效并提示
    window.playSound('money'); // 假设你有金币音效，没有就用 'click'
    // 这里使用我们刚写的自定义弹窗！
    window.showAlert(`成功购买了 <strong>[${itemName}]</strong>！<br>剩余灵石: ${p.spiritStones}`, "交易成功");
    
    // 4. 刷新界面
    updateUI();
};
// main.js 最底部

// ==========================================
// 🛠️ 上帝模式调试工具 (God Mode)
// ==========================================
window.God = {
    // 1. 强制怀孕：选中谁，谁就怀 (God.preg())
    preg: (num = 1) => {
        let p = findPerson(gameState.selectedPersonId);
        if(!p) return "先在界面上选中一个人";
        p.pregnancyProgress = 1;
        p.birthTarget = 1; // 下回合就生
        p.childParentId = gameState.player.id;
        // 如果输入 God.preg(3) 就生三胞胎
        if(num > 1) gameState.player.buffs = { next_multi: true }; 
        updateUI();
        return `✅ ${p.name} 已强制怀孕，下回合生产！`;
    },

    // 2. 强制突破：选中谁，谁就升级 (God.levelup())
    levelup: () => {
        let p = findPerson(gameState.selectedPersonId);
        if(!p) return "先选中一个人";
        p.power += 1000; // 简单粗暴加修为
        // 也可以调用 handleBreakthrough(p) 强制尝试突破
        updateUI();
        return `✅ ${p.name} 修为暴涨！`;
    },

    // 3. 强制结仇：选中谁，谁就恨你 (God.hate())
    hate: () => {
        let p = findPerson(gameState.selectedPersonId);
        if(!p) return "先选中一个人";
        p.favor = -100;
        p.isNemesis = true;
        updateUI();
        return `✅ ${p.name} 现在恨死你了！`;
    },

    // 4. 查看真实数据 (God.info())
    info: () => {
        let p = findPerson(gameState.selectedPersonId);
        if(!p) return "无选中目标";
        console.table(p); // 以表格形式打印详细数据
        return "数据已打印在控制台";
    },
    // 5. 【测试专用】导演一出劫狱大戏
    testRescue: () => {
        // 1. 检查人数
        if (gameState.npcs.length < 2) return "❌ NPC 不够，至少需要2个人才能演戏！";

        // 2. 钦定演员
        let villain = gameState.npcs[0]; // 反派 (囚禁者)
        let hero = gameState.npcs[1];    // 英雄 (营救者)

        // 3. 设定反派属性 (强无敌)
        villain.name = "大魔王(测试)";
        villain.power = 10000;  // 1万战力
        villain.darkness = 100; // 纯黑
        villain.isDead = false;
        villain.isImprisoned = false;

        // 4. 设定英雄属性 (为了测试胜率，设为反派的 80% + 满爱意)
        hero.name = "救世主(测试)";
        hero.power = 8500; // 85% 战力，胜率较高
        hero.love = 100;   // 爱意拉满
        hero.isDead = false;
        hero.isImprisoned = false;
        // 给他加个 buff 方便看日志
        if (!hero.traits) hero.traits = [];
        hero.traits.push({ name: "剑心", description: "测试Buff" }); 

        // 5. 设定玩家状态 (被囚禁)
        gameState.isPlayerImprisoned = true;
        gameState.captorId = villain.id;
        
        // 6. 强制同步位置
        gameState.player.location = "sect";
        villain.location = "sect";
        hero.location = "sect";

        console.log(`🎬 劫狱测试开始！\n囚禁者: ${villain.name} (战力${villain.power})\n营救者: ${hero.name} (战力${hero.power})`);

        // 7. 直接调用逻辑！
        if (window.handleRescueAttempt) {
            window.handleRescueAttempt(villain);
            updateUI();
            return "✅ 劫狱剧本已执行，请查看游戏日志！";
        } else {
            return "❌ handleRescueAttempt 未挂载，请检查 logic.js！";
        }
    }
};
// ================= 上帝模式 (Dev Functions) =================

// 1. 灵石天降
window.devAddStones = function() {
    let p = gameState.player;
    p.spiritStones = (p.spiritStones || 0) + 1000;
    addLog(`【上帝模式】造物主拨弄了因果，你凭空获得了 1000 灵石。`, "#f1c40f");
    updateUI();
};

// 2. 醍醐灌顶 (增加修为)
window.devAddPower = function() {
    let p = gameState.player;
    p.power += 5000;
    addLog(`【上帝模式】一道金光落下，你的修为暴涨 5000 点！`, "#f1c40f");
    // 顺便更新一下最大修为记录
    p.maxPower = Math.max(p.power, p.maxPower || 0);
    updateUI();
};

// 3. 精力充沛 (补满 AP)
window.devFullAP = function() {
    gameState.player.ap = gameState.player.maxAP;
    addLog(`【上帝模式】你感到神清气爽，精力已完全恢复。`, "#f1c40f");
    updateUI();
};

// 4. 寿命无限 (增加 100 岁寿元)
window.devAddLife = function() {
    let p = gameState.player;
    // 直接修改我们之前算的 lifeFactor 或者基础值
    p.lifeFactor = (p.lifeFactor || 1.0) + 1.25; 
    addLog(`【上帝模式】你向天再借了五百年（增加了大量寿元上限）。`, "#f1c40f");
    // 重新计算一下显示值
    checkLifeStatus(p); 
    updateUI();
};
window.openSoulHistory = openSoulHistory;
window.findPerson = findPerson;

// --- 开场动画逻辑 (点击切换版) ---

let currentIntroIndex = 0; // 记录当前讲到第几句了

// 1. 开始播放开场
function playIntro() {
    // 隐藏开始界面
    document.getElementById('startScreen').style.display = 'none';
    
    // 显示开场界面 (注意要用 flex 以便居中)
    const introEl = document.getElementById('introScreen');
    introEl.style.display = 'flex';
    
    // 重置索引
    currentIntroIndex = 0;
    
    // 播放BGM
    if (window.playBGM) window.playBGM();

    // 显示第一句
    renderIntroLine();
}

// 2. 显示当前句子的辅助函数
function renderIntroLine() {
    const contentEl = document.getElementById('storyContent');
    const text = INTRO_STORY[currentIntroIndex];
    
    // 插入文字 (每次插入都会重新触发 CSS 的 fade-in 动画)
    contentEl.innerHTML = `<div class="story-line">${text}</div>`;
    
    // 播放一个轻微的翻页音效 (如果有的话，用 hover 暂替)
    if(window.playSound) window.playSound('hover');
}

// 3. 点击屏幕：显示下一句
function showNextIntro() {
    currentIntroIndex++;
    
    // 如果还没讲完
    if (currentIntroIndex < INTRO_STORY.length) {
        renderIntroLine();
    } 
    // 如果讲完了
    else {
        endIntro();
    }
}

// 4. 结束开场
function endIntro() {
    const introEl = document.getElementById('introScreen');
    introEl.style.display = 'none';
    
    // 正式进入捏人界面
    window.openCharCreator(); 
}

// 挂载到 window
window.playIntro = playIntro;
window.showNextIntro = showNextIntro; // 新增挂载
window.endIntro = endIntro;