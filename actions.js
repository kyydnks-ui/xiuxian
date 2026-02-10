// actions.js
// 新的动作管理模块
import { gameState, findPerson } from './state.js';
import { DB } from './data.js'; // <--- 新增这一行
import { changeEmotion, calculateMatchScore, handlePersuasion, findMediator } from './logic.js';
import { Text } from './text.js';
import { addLog, linkName, randomInt, randomChoice, isRelated } from './utils.js';
import { updateUI, openDetail, closeModal } from './ui.js'; // 动作执行完通常需要刷新UI
import { History } from './history.js';
import { getLocationName, LOCATIONS } from './locations.js';
import { G_CONFIG } from './config.js';
// 动作注册表，用来存放所有新式动作
const ACTION_REGISTRY = {};

// 动作基类（或者叫结构定义）
class Action {
    constructor(def) {
        this.id = def.id;
        this.cost = def.cost || 0; // 精力消耗
        this.run = def.run; // 具体逻辑函数
    }

    // 执行入口
    execute(person) {
    
        if (person.isDead) {
            addLog(`对方已驾鹤西去。`, "#7f8c8d");
            updateUI(); 
            if (gameState.selectedPersonId === person.id) openDetail(person.id);
            return;
        }

        // 1. 检查精力
        if (gameState.player.ap < this.cost) {
            console.log("拦截：精力真的不够了！当前 AP:", gameState.player.ap);
            addLog(`【精力不足】你太累了，无法进行此操作。请闭关休息(下个月)。`, "#7f8c8d");
            return;
        }

        // 2. 扣除精力
        gameState.player.ap -= this.cost;

        // 3. 执行具体逻辑 (如 talk, gift 等)
        this.run(person);

        // 4. 刷新全局 UI
        updateUI();

        // 5. 打开详情弹窗
        if (gameState.selectedPersonId === person.id) {
            openDetail(person.id);
        }
    }
}

// === 管理器接口 ===
export const ActionManager = {
    // 注册动作
    register: function(def) {
        ACTION_REGISTRY[def.id] = new Action(def);
    },

    // 检查动作是否存在
    has: function(id) {
        return !!ACTION_REGISTRY[id];
    },

    // 执行动作
    run: function(id, person) {
        if (this.has(id)) {
            ACTION_REGISTRY[id].execute(person);
            return true; // 执行成功
        }
        return false; // 没找到动作，可能在旧系统里
    }
};

// --- 交谈 (数值逻辑升级版) ---
ActionManager.register({
    id: 'talk',
    cost: G_CONFIG.ACTIONS.TALK.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.TALK;
        const player = gameState.player;
        // 1. 获取性格参数
        let params = person.personality.params || { favorRate: 1.0, loveRate: 1.0 };
        let pName = person.personality.name;

        // 2. 基础数值计算 (引入倍率)
        let baseGain = randomInt(cfg.FAVOR_BASE_MIN, cfg.FAVOR_BASE_MAX);
        let finalFavor = Math.ceil(baseGain * params.favorRate);
        
        // === 【新增：醋意惩罚判定】 ===
        let isJealous = false;
        let acidMsg = "";
        // 判定条件：有最后一次情人且不是当前NPC，且对方爱意 > 40
        if (player.lastLoverId && player.lastLoverId !== person.id && person.love > 40) {
            isJealous = true;
            // 获取词库（假设已在 text.js 挂载到 window）
            const texts = window.JEALOUSY_TEXTS;
            let style = "SARCASTIC";
            if (person.personality.name === "温润" || person.personality.name === "痴绝") style = "PITIFUL";
            if (person.personality.name === "骄阳" || person.personality.name === "疏狂") style = "AGGRESSIVE";
            
            const pool = texts[style];
            acidMsg = pool[Math.floor(Math.random() * pool.length)];
            
            // 惩罚：好感收益减半，且额外扣除好感
            finalFavor = Math.floor(finalFavor * 0.5); 
            person.favor = Math.max(0, person.favor - 5);
        }
        changeEmotion(person, 'favor_social', finalFavor);
        
        // 3. 动情判定 (引入 loveRate)
        let loveLog = "";
        if (person.favor > cfg.LOVE_TRIGGER_FAVOR) {
            let roll = Math.random();
            // 基础动情概率 20%
           if (roll < cfg.CHANCE_LOVE_HIGH) {
                let loveGain = cfg.LOVE_GAIN_HIGH;
                changeEmotion(person, 'love', loveGain);
                loveLog = `<br><span style='color:#e91e63; font-weight:bold; font-size:11px;'>❤ 怦然心动！(感情+${loveGain})</span>`;
            } else if (roll < cfg.CHANCE_LOVE_MID) { 
                let loveGain = randomInt(cfg.FAVOR_BASE_MIN, cfg.FAVOR_BASE_MAX);
                changeEmotion(person, 'love', loveGain);
                loveLog = `<br><span style='color:#e91e63; font-size:11px;'>❤ 感情升温中...(感情+${loveGain})</span>`;
            }
        }

      // ★★★ 4. 获取文案 (核心修改) ★★★
        // 先尝试获取“特殊固定NPC”的行为描述
        
        let specialText = Text.getSpecialDialogue ? Text.getSpecialDialogue(person, "chat") : null;
if (isJealous) {
            // A. 醋意爆发：覆盖所有普通对话
            addLog(`你与 ${linkName(person)} 交谈。${person.name} 面带寒霜，冷冷道：“${acidMsg}” <span style="color:#d35400">(好感+${finalFavor})</span>${loveLog}`, "#e67e22");
        } else if (specialText) {
            // A. 特殊NPC：直接接在后面，不加“说道”，不加引号
            // 效果：你与 [莫离] 交谈。他正在擦拭桌椅...
            addLog(`你与 ${linkName(person)} 交谈。${specialText} <span style="color:#2ecc71">(好感+${finalFavor})</span>${loveLog}`, "#34495e");
        } else {
            // B. 普通NPC：走原来的随机对话逻辑
            let isChild = gameState.children.some(c => c.id === person.id);
            let isSpouse = (gameState.spouseId === person.id);
            let msg = Text.Dialogue.getTalk(person, isChild, isSpouse, gameState.spouseId);
            
            addLog(`你与 ${linkName(person)} 交谈。${msg} <span style="color:#2ecc71">(好感+${finalFavor})</span>${loveLog}`);
        }
       

// ============================================================
// 5. 地图解锁逻辑
// 只有当“对方有门派” 且 “玩家还没解锁该门派” 时，才执行下面的所有逻辑
// ============================================================
if (person.homeSect && !gameState.unlockedLocations.includes(person.homeSect)) {

    let revealChance = 0;
        
    // 规则A: 已经是好友/恋人 (100% 解锁)
    if (person.favor >= cfg.REVEAL_FAVOR_LIMIT || person.love >= cfg.REVEAL_LOVE_LIMIT) revealChance = 100;
        
    // 规则B: 热情的一见钟情男角色 (好感>10, 魅力>8, 异性) -> 50% 解锁
    else if (person.gender !== gameState.player.gender && person.favor > cfg.NPC_FAVOR_MIN && gameState.player.charm > cfg.PLAYER_CHARM_MIN) {
        revealChance = cfg.CHANCE_CHARM_REVEAL; 
        
        // 【注意】这里是你原代码的逻辑：先随机一次看是否触发“面色微红”的描写
        // 因为外层加了判断，所以这句描写现在只会在“第一次解锁”时出现，不会再刷屏了
        if (Math.random() * 100 < revealChance) {
            addLog(`${person.name} 看着你的脸庞，面色微红，主动提起了自己的师门...`, "#d35400");
        }
    }
        
    // 规则C: 普通闲聊 (10% 解锁)
    else {
        revealChance = cfg.CHANCE_NORMAL_REVEAL;
    }

    // 执行最终判定
    if (Math.random() * 100 < revealChance) {
        // 如果是普通闲聊触发，补一句日志 (同样，现在只会在解锁那一刻显示)
        if (revealChance === cfg.CHANCE_NORMAL_REVEAL) addLog(`${person.name} 与你相谈甚欢，顺口提到了家乡。`, "#34495e");
        
        // 真正执行解锁
        tryRevealMap(person);
       
        // 【新增】灵魂回响 / 识破判定 (Phase 2)
        if (!person.isSoulMate && !person.isNemesis && gameState.player.motherId) {
            
            let prevId = gameState.player.motherId;
            let prevRel = person.relationships[prevId] || 0;
            
            // 只有极高关系才触发
            if (Math.abs(prevRel) > G_CONFIG.SOUL_ECHO.MIN_RELATION_LIMIT) {
                // 基础 5% + 智力加成
                let chance = 5 + (person.int * G_CONFIG.SOUL_ECHO.INT_BONUS_MULT);
                
                // 触发判定
                if (Math.random() * 100 < chance) {
                    // 异步调用触发函数 (避免阻塞当前 UI 刷新)
                    // 使用 setTimeout 把弹窗推到 UI 刷新之后
                    setTimeout(() => {
                        
                        if (window.triggerSoulEchoEvent) window.triggerSoulEchoEvent(person);
                    }, 500);
                }
            }
        }
        // ============================================
    }
}
        // 履历
        History.record(person, 'social', `与 [${gameState.player.name}] 促膝长谈，关系更近了一步。`);
        History.record(gameState.player, 'social', `与 [${person.name}] 进行了一番交谈。`);
   // === 【关键注入】交谈完，对方可能会把你抓起来 ===
        if (!gameState.isPlayerImprisoned) {
            window.checkPlayerCaptured(person);
        }
    }
});

// --- 赠礼 (数值逻辑升级版) ---
ActionManager.register({
    id: 'gift',
    cost: G_CONFIG.ACTIONS.GIFT.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.GIFT;
        if(gameState.player.items.length > 0) {
            let giftName = gameState.player.items.shift();
            let giftDef = DB.items.find(i => i.name === giftName);
            
            // 1. 估算物品价值 (根据效果强度简单判断)
            let value = cfg.VAL_DEFAULT; // 默认普通
            if (giftDef) {
                if (giftDef.effect.includes('50') || giftDef.effect.includes('100')) value = cfg.VAL_HIGH; // 贵重
                if (giftName.includes("极品") || giftName.includes("宝") || giftName.includes("丹")) value = cfg.VAL_HIGH;
                if (giftName === "瓜果" || giftName === "木雕") value = cfg.VAL_LOW; // 便宜
            }

            // 2. 获取性格数值 (如果旧存档没有stats，给个默认值)
            let stats = person.personality.stats || { moral: 50, desire: 50, devotion: 50 };
            let pName = person.personality.name;
            let favorGain = cfg.GAIN_BASE; // 基础好感
            let logMsg = "";

            // --- 逻辑挂钩：欲望 (Desire) ---
            
            // A. 市侩 (认钱不认人)
            if (pName === "市侩") {
                if (value >= cfg.VAL_HIGH) {
                    favorGain = cfg.BONUS_MARKET_HIGH; 
                    logMsg = `（两眼放光）“哎呀，这多不好意思……那我就却之不恭了！”`;
                } else if (value <= cfg.VAL_LOW) {
                    favorGain = cfg.PENALTY_MARKET_LOW; 
                    logMsg = `（嫌弃地看了一眼）“就这？道友莫不是在打发叫花子？”`;
                }
            } 
            // B. 守心 (视金钱如粪土)
            else if (pName === "守心") {
                if (value >= cfg.VAL_HIGH) {
                    gameState.player.items.unshift(giftName); 
                    addLog(`${linkName(person)} 摇了摇头：“此物太过贵重，贫道受之有愧，请回吧。”`, "#7f8c8d");
                    return; 
                } else {
                    favorGain = cfg.GAIN_PURE_HEART; 
                    logMsg = `“礼轻情意重，道友破费了。”`;
                }
            }
            // C. 痴绝 (你是电你是光)
           else if (pName === "痴绝") {
                favorGain += cfg.BONUS_OBSESSED; 
                if (value <= cfg.VAL_LOW) {
                    logMsg = `（如获至宝地捧在手心）“这是你特意为我挑的吗？我会好好珍藏的。”`;
                }
            }
            // D. 普通人
            else {
                if (value >= cfg.VAL_HIGH) favorGain += cfg.BONUS_NORMAL_HIGH;
                logMsg = `收下了你的 [${giftName}]。`;
            }

            // 3. 执行变动
            changeEmotion(person, 'favor', favorGain);
            // 送贵重物品会轻微刺激欲望
            if (value >= cfg.VAL_HIGH && person.personality.stats) person.personality.stats.desire += cfg.DESIRE_EROSION;

            addLog(`你赠送了 [${giftName}]。${linkName(person)}：${logMsg} (好感${favorGain>0?'+':''}${favorGain})`);

        } else {
            // 没东西送，送点瓜果
            changeEmotion(person, 'favor', cfg.GAIN_EMPTY);
            addLog(`你囊中羞涩，只送了一些路边采摘的瓜果。(好感+${cfg.GAIN_EMPTY})`);
        }
    }
});

// --- 攻击/切磋 (骨相深度实装版) ---
ActionManager.register({
    id: 'attack',
    cost: G_CONFIG.BATTLE.COST_AP, 
    run: (person) => {
        const cfg = G_CONFIG.BATTLE;
        const pDao = person.personality.dao;
        
        // 1. 战力计算 (使用智力系数配置 0.005)
        let playerPower = gameState.player.power * (1 + gameState.player.int * cfg.INT_BONUS_MULT);
        let npcPower = person.power * (1 + person.int * cfg.INT_BONUS_MULT);
        
        // ▼▼▼ 修改点：唯我者爆发 (1.1) ▼▼▼
        if (pDao === 'realist') npcPower *= cfg.REALIST_BURST; 

        // ▼▼▼ 修改点：随机波动配置 (0.8, 0.4) ▼▼▼
        let pRoll = playerPower * (cfg.ROLL_MIN + Math.random() * cfg.ROLL_RANGE);
        let nRoll = npcPower * (cfg.ROLL_MIN + Math.random() * cfg.ROLL_RANGE);
        
        let isWin = pRoll > nRoll;
        
        // 2. 战斗结果分支
        if (isWin) {
            addLog(`你发起突袭！经过一番激战，你击败了 ${linkName(person)}。`, "#e74c3c");
            
            // ▼▼▼ 修改点：修为伤害逻辑 (0.3) ▼▼▼
            let baseDamage = Math.max(1, Math.floor(gameState.player.power * cfg.WIN_DAMAGE_RATE));
            let lose = Math.min(person.power, baseDamage);
            person.power = Math.max(0, person.power - lose);
            
            if (person.power === 0) {
                addLog(`${linkName(person)} 修备被你彻底打散，只剩一口气吊着。`, "#c0392b");
            }
            
            // ▼▼▼ 修改点：情感变动全部配置化 ▼▼▼
            changeEmotion(person, 'favor', cfg.FAVOR_WIN_LOSS);
            
            // --- 骨相反应：输了怎么求饶？---
            switch (pDao) {
                case 'realist': // 唯我者：毫无尊严，卖友求荣
                    addLog(`${linkName(person)} 立刻跪地求饶：“大侠饶命！我有宝物献上！”`, "#d35400");
                    addLog(`(唯我者在生存面前，尊严一文不值)`, "#7f8c8d");
                    // 强制献礼 (如果有物品)
                    changeEmotion(person, 'favor', cfg.FAVOR_REALIST_SUBMIT); // 扣得反而不多，因为他服了
                    // 模拟献宝逻辑(略)
                    break;
                    
                case 'humanist': // 入世者：情感波动
                    if (person.love > 50 || person.favor > 60) {
                        addLog(`${linkName(person)} 放弃了抵抗，哀伤地看着你：“若是我的死能平息你的怒火...”`, "#e91e63");
                        addLog(`(入世者不愿与挚爱之人相杀)`, "#7f8c8d");
                        changeEmotion(person, 'love', cfg.LOVE_HUMANIST_TWISTED); // 甚至可能增加扭曲的爱意(虐恋)
                    } else {
                        addLog(`${linkName(person)} 捂着伤口倒退：“你我往日无冤，何至于此？”`, "#95a5a6");
                    }
                    break;
                    
                case 'seeker': // 求道者：认可强者
                    addLog(`${linkName(person)} 擦去嘴角鲜血：“好身手。是我的道行浅了。”`, "#3498db");
                    addLog(`(求道者敬畏力量)`, "#7f8c8d");
                   changeEmotion(person, 'favor', cfg.FAVOR_SEEKER_RESPECT); // 甚至可能加好感（不打不相识）
                    break;
            }
            
            // 战利品 (简化)：吸取少量战斗经验
            gameState.player.power += cfg.WIN_EXP_GAIN;
            
        } else {
            // === 玩家战败 (NPC 赢了) ===
            // 1. 基础惩罚：扣除修为 
            let loss = Math.floor(gameState.player.power * 0.05); // 输了扣 5%
            gameState.player.power = Math.max(0, gameState.player.power - loss);

            // =================================================
            // ▼▼▼ 新增：R18 战败羞辱 (优先触发) ▼▼▼
            // =================================================
            let r18Triggered = false;
            
            // 只有开启 R18 且 (对方是坏人 OR 在野外 OR 关系极端) 时触发
            if (gameState.settings && gameState.settings.enableR18) {
                let isBadPerson = ['痴绝', '疏狂', '市侩'].includes(person.personality.name);
                let isBadLocation = gameState.player.location === 'wild';
                let isExtreme = person.favor < -20 || person.love > 60; // 恨死你或爱死你

                if (isBadPerson || isBadLocation || isExtreme) {
                    r18Triggered = true;
                    
                    let humiliateTexts = [
                        `[羞辱] ${linkName(person)} 一脚踩在你胸口，居高临下地看着衣衫凌乱的你，指尖划过你的脸颊：“这就没力气了？刚才那股狠劲儿哪去了？”`,
                        `[战败] 你无力地倒在地上，${linkName(person)} 欺身压上，粗暴地撕开你的衣领，贪婪地嗅着你颈间的汗味：“输了的人，可是要付出代价的……”`,
                        `[凌虐] ${linkName(person)} 并没有急着补最后一刀，而是用剑鞘挑起你的下巴，目光肆无忌惮地游走在你颤抖的身体上：“啧，身子比剑法软多了。”`
                    ];
                    // 野外专属
                    if (isBadLocation) {
                         humiliateTexts.push(`[野战] 在这荒无人烟的野外，${linkName(person)} 将你按在粗糙的树干上，强行分开你的双腿：“在这里叫破喉咙也没人会来救你，乖乖变成我的炉鼎吧！”`);
                    }
                    
                    addLog(randomChoice(humiliateTexts), "#c0392b");
                }
            }

            // =================================================
            // ▼▼▼ 原有逻辑：如果没触发 R18，则走普通骨相判定 ▼▼▼
            // =================================================
            if (!r18Triggered) {
                addLog(`你发起突袭，却被 ${linkName(person)} 一招制服！(修为 -${loss})`, "#2c3e50");
                
                // 保留你原有的 switch (pDao) 逻辑
                switch (pDao) {
                    case 'realist': // 唯我者
                        addLog(`${linkName(person)} 冷笑一声：“送上门的肥羊。”`, "#c0392b");
                        // 偷钱逻辑
                        if (gameState.player.spiritStones > 0) { // 注意：钱的变量名通常是 spiritStones
                            let rob = Math.floor(gameState.player.spiritStones * 0.1);
                            gameState.player.spiritStones -= rob;
                            addLog(`你不慎遗失了 ${rob} 灵石。`, "#7f8c8d");
                        }
                        changeEmotion(person, 'favor', -5);
                        break;
                        
                    case 'humanist': // 入世者
                        addLog(`${linkName(person)} 收起了法术：“快走吧，我不想伤你。”`, "#2ecc71");
                        changeEmotion(person, 'favor', 2);
                        break;
                        
                    case 'seeker': // 求道者
                        addLog(`${linkName(person)} 摇了摇头：“心浮气躁，难成大道。”`, "#34495e");
                        changeEmotion(person, 'favor', -2);
                        break;
                    
                    default: // 默认兜底
                        addLog(`${linkName(person)} 似乎对你失去了兴趣，转身离去。`, "#95a5a6");
                        break;
                }
            }
            
            // 3. 记录历史
            person.state = 'idle';
            if(window.updateUI) updateUI();
            History.record(person, 'battle', `在切磋中击败了 [${gameState.player.name}]。`);
        }
        History.record(person, 'battle', `遭遇 [${gameState.player.name}] 无故袭击，身受重伤。`);
        History.record(gameState.player, 'battle', `出手教训了 [${person.name}]，打散其部分修为。`);
    }
});

// --- 偷窃 (数值逻辑升级版) ---
ActionManager.register({
    id: 'steal',
    cost: G_CONFIG.ACTIONS.STEAL.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.STEAL;
        let pName = person.personality.name;

        if(gameState.player.int > person.int) {
            // 成功逻辑不变
            if(person.items.length > 0) {
                let item = person.items.pop();
                gameState.player.items.push(item);
                addLog(`你偷到了 ${linkName(person)} 的 [${item}]！`, "#27ae60");
                History.record(gameState.player, 'general', `妙手空空，从 [${person.name}] 身上顺走了 [${item}]。`);
                History.record(person, 'general', `随身携带的 [${item}] 不翼而飞。`);
            } else {
                addLog(`${linkName(person)} 身上穷得叮当响。`, "#7f8c8d");
            }
        } else { 
            // 失败惩罚逻辑
           let favorLoss = cfg.FAVOR_LOSS_NORMAL;
            let darknessGain = cfg.BASE_DARKNESS_GAIN;
            let logMsg = "";

           if (pName === "市侩") {
                favorLoss = cfg.FAVOR_LOSS_MARKET; 
                logMsg = `捂着钱袋子尖叫起来：“抓贼啊！有人偷东西！！”`;
            } else if (pName === "疏狂") {
                favorLoss = cfg.FAVOR_LOSS_ARROGANT; 
                logMsg = `似笑非笑地看着你：“手伸到哪去了？想要的话直说嘛。”`;
            } else if (pName === "清贵") {
                favorLoss = cfg.FAVOR_LOSS_NOBLE; 
                logMsg = `眼神轻蔑：“堂堂修士竟做此鸡鸣狗盗之事，可笑。”`;
            } else {
                logMsg = `一把抓住了你的手：“你想干什么？！”`;
            }
addLog(`偷窃失败！${linkName(person)} ${logMsg}`, "#c0392b");

            changeEmotion(person, 'favor', favorLoss);
            changeEmotion(person, 'darkness', darknessGain);
            History.record(person, 'battle', `当场抓获了行窃的 [${gameState.player.name}]，引得众人指指点点。`);
            History.record(gameState.player, 'battle', `试图行窃 [${person.name}] 惨遭识破，狼狈不堪。`);
        }
    }
});

// --- 处决 (Kill) ---
ActionManager.register({
    id: 'kill',
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.KILL;
        // 1. 计算业力 (黑化值) 惩罚
        let penalty = cfg.BASE_DARKNESS_GAIN;
        
        // 如果杀的是宿敌，杀气更重
        if (person.isNemesis) penalty += cfg.NEMESIS_EXTRA_DARK;
        
        // 如果杀的是道侣或灵魂伴侣
        if (gameState.spouseId === person.id || person.isSoulMate) {
            penalty = cfg.SOULMATE_PENALTY;
        }

        // 应用黑化变动 (调用我们之前的核心引擎)
        // 注意：处决是不可逆的黑暗行为，所以直接给 value
        changeEmotion(gameState.player, 'darkness', penalty);
        // 1. 标记死亡，而不是删除数据
        person.isDead = true; 
        person.deathReason = "被你处决"; 
        // ▼▼▼ 新增：记录处决履历 ▼▼▼
        let loc = getLocationName(gameState.player.location); // 凶手(你)在哪，他就在哪
        History.record(person, 'life', `于 [${loc}] 被 [${gameState.player.name}] 处决，仓促结束了一生。`);
        History.record(gameState.player, 'battle', `手起刀落，冷酷地处决了 [${person.name}]。`); 
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        // 2. 清理人际关系
        if(gameState.spouseId === person.id) gameState.spouseId = null;
        person.isSpouse = false;
        
        // 3. 如果在监狱里，也要把囚禁状态去掉，人都死了还关什么
        person.isImprisoned = false; 

        addLog(`你冷酷地处决了 ${linkName(person)}。`, "#2c3e50");
        
        // 4. 强制刷新UI，让他在主界面消失（因为主界面有 filter(!isDead)）
        // 这一步 Action 基类会自动调用 updateUI，所以这里不写也没事，但逻辑上是通的
    }
});

// --- 绑架 (数值逻辑升级版) ---
ActionManager.register({
    id: 'kidnap',
    cost: G_CONFIG.ACTIONS.KIDNAP.COST, // 囚禁消耗 1 点精力（如果你想改为0，改这里即可）
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.KIDNAP;
        person.isImprisoned = true;
        // 囚犯始终跟随玩家所在地点（统一视为被关在“你所在之地”的地牢）
        person.location = gameState.player.location;
        let pName = person.personality.name;
        
       let favorLoss = cfg.FAVOR_LOSS_NORMAL;
        let darknessGain = cfg.DARKNESS_GAIN_NORMAL;
        let loveChange = 0;

        if (pName === "痴绝") {
            favorLoss = cfg.FAVOR_LOSS_OBSESSED; 
            darknessGain = cfg.DARKNESS_GAIN_OBSESSED; 
            loveChange = cfg.LOVE_GAIN_OBSESSED; 
            addLog(`你将 ${linkName(person)} 拖回地牢。他竟然看起来并没有想象中生气...`, "#8e44ad");
        } else if (pName === "清贵") {
            favorLoss = cfg.FAVOR_LOSS_NOBLE; 
            darknessGain = cfg.DARKNESS_GAIN_NOBLE; 
            addLog(`你将 ${linkName(person)} 拖回地牢。他死死盯着你，眼中满是屈辱。`, "#2c3e50");
        } else {
            addLog(`你将重伤的 ${linkName(person)} 拖回地牢，戴上了镣铐！`, "#2c3e50");
        }

        changeEmotion(person, 'favor', favorLoss);
        changeEmotion(person, 'darkness', darknessGain);
        if (loveChange !== 0) changeEmotion(person, 'love', loveChange);

        History.record(person, 'life', `被 [${gameState.player.name}] 强行掳走，囚禁于暗无天日的地牢。`);
        History.record(gameState.player, 'battle', `将重伤的 [${person.name}] 掳回地牢。`);
    }
});

// --- 释放 (数值逻辑升级版) ---
ActionManager.register({
    id: 'release',
    cost: G_CONFIG.ACTIONS.RELEASE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.RELEASE;
        person.isImprisoned = false;
        let pName = person.personality.name;
        
        // 1. 痴绝特殊判定：放走 = 抛弃
       if (pName === "痴绝") {
            changeEmotion(person, 'darkness', cfg.OBSESSED_DARK_GAIN);
            addLog(`你放走了 ${linkName(person)}。他一步三回头，绝望地问：“是你不要我了吗？”`, "#9b59b6");
            History.record(person, 'life', `被 [${gameState.player.name}] 逐出地牢，心中却将其视为被抛弃。`);
            History.record(gameState.player, 'battle', `将 [${person.name}] 释放，对方竟有些依依不舍。`);
        }
// 2. 仇敌判定 (黑化太高，放走就是放虎归山)
       else if (person.darkness > cfg.NEMESIS_DARK_LIMIT || ["市侩", "孤绝", "清贵"].includes(pName)) {
            person.isNemesis = true;
            addLog(`你放走了 ${linkName(person)}。他眼神阴狠，似乎并不领情。`, "#c0392b");
            History.record(person, 'life', `逃出生天，发誓要向 [${gameState.player.name}] 复仇。`);
            History.record(gameState.player, 'life', `放虎归山，释放了满怀仇恨的 [${person.name}]。`);
        }
       // 3. 斯德哥尔摩判定 (高魅力 + 概率)
        else if (gameState.player.charm > cfg.STOCKHOLM_CHARM_REQ && Math.random() < cfg.STOCKHOLM_CHANCE) {
            person.isStockholm = true; // 可以在后续逻辑中判断此标记
            person.favor = cfg.STOCKHOLM_FAVOR; 
            person.love = cfg.STOCKHOLM_LOVE; 
            person.darkness = cfg.STOCKHOLM_DARK; 
            addLog(`你放走了 ${linkName(person)}。他神色复杂，似乎对你产生了某种扭曲的依恋...`, "#e056fd");
            History.record(person, 'love', `被释放后，竟对 [${gameState.player.name}] 竟对这个曾经囚禁自己的魔头产生了扭曲的爱意...`);
       History.record(gameState.player, 'love', `释放了 [${person.name}]，对方走前深深看了 [${gameState.player.name}] 一眼，似乎对自己产生了某种病态的依恋。`);
        }
     // 4. 普通释放
        else {
            addLog(`你放走了 ${linkName(person)}。`, "#95a5a6");
            History.record(person, 'life', `被 [${gameState.player.name}] 释放，重获自由。`);
            History.record(gameState.player, 'life', `大发慈悲，释放了囚犯 [${person.name}]。`);
            // 发送 'favor_righteous' 信号，让【求道者】和【守心】的人对你刮目相看
            changeEmotion(person, 'favor_righteous', cfg.RIGHTEOUS_FAVOR);
        }
    }
});

ActionManager.register({
    id: 'confiscate',
    cost: G_CONFIG.ACTIONS.CONFISCATE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.CONFISCATE;
        if (person.items.length > 0) {
            // 先保存物品列表，用于日志显示
            let itemList = person.items.join('、');
            
            // 转移物品
            gameState.player.items = gameState.player.items.concat(person.items);
            person.items = []; // 清空

            let pName = person.personality.name;
            let logMsg = "";
            let color = "#27ae60"; // 默认绿色

            // --- 性格反应差分 ---
            switch (pName) {
                case "市侩":
                    logMsg = `${linkName(person)} 哭天抢地：“杀了我吧！把钱抢走还不如杀了我！”`;
                    changeEmotion(person, 'darkness', cfg.MARKET.DARK);
                    changeEmotion(person, 'favor', cfg.MARKET.FAVOR);
                    color = "#e67e22";
                    break;
                case "清贵":
                    logMsg = `${linkName(person)} 别过脸去，满脸屈辱：“虎落平阳被犬欺……”`;
                    changeEmotion(person, 'darkness', cfg.NOBLE.DARK);
                    changeEmotion(person, 'favor', cfg.NOBLE.FAVOR);
                    color = "#c0392b";
                    break;
                case "痴绝":
                    logMsg = `${linkName(person)} 眼神幽幽看着你，并不说话...`;
                    changeEmotion(person, 'love', cfg.OBSESSED.LOVE);
                    color = "#9b59b6";
                    break;
                case "孤绝":
                    logMsg = `${linkName(person)} 冷冷地看着你，仿佛被抢的根本不是他的东西。`;
                    changeEmotion(person, 'favor', cfg.LONELY.FAVOR);
                    color = "#7f8c8d";
                    break;
                case "疏狂":
                    logMsg = `${linkName(person)} 嗤笑一声：“哎呀，道友手脚倒是利索。”`;
                    changeEmotion(person, 'favor', cfg.ARROGANT.FAVOR);
                    break;
                case "守心":
                    logMsg = `${linkName(person)} 闭目叹息：“身外之物，生不带来死不带去。”`;
                    // 注意：这里的 moral 也是一种情感维度
                    changeEmotion(person, 'moral', cfg.PURE.MORAL);
                    break;
                case "骄阳":
                    logMsg = `${linkName(person)} 咬牙切齿：“喂！那是我的！”`;
                    changeEmotion(person, 'favor', cfg.SUNNY.FAVOR);
                    break;
                case "温润":
                    logMsg = `${linkName(person)} 摇头：“若这些能解道友燃眉之急，便拿去吧。”`;
                    break;
                default:
                    logMsg = `你搜刮了囚犯 ${linkName(person)} 的所有财物。`;
            }

            // 输出日志
            addLog(logMsg, color);
            addLog(`(获得了: ${itemList})`, "#27ae60");

            // 履历
            History.record(person, 'life', `随身财物被 [${gameState.player.name}] 洗劫一空。`);
            History.record(gameState.player, 'battle', `搜刮了囚犯 [${person.name}] 的财物。`);

        } else {
            addLog(`囚犯 ${linkName(person)} 身上已经一无所有了。`, "#7f8c8d");
        }
    }
});



// --- 提亲 (数值逻辑升级版) ---
ActionManager.register({
    id: 'marry_request',
    cost: G_CONFIG.ACTIONS.MARRY.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.MARRY;
        // === 伦理检查 ===
        // 如果是近亲，且没有“灵魂伴侣”标签(前世情人)，则禁止
        if (isRelated(gameState.player, person) && !person.isSoulMate) {
            addLog(`【伦理禁忌】你与 ${person.name} 血脉相连，不可行此苟且之事！`, "#c0392b");
            // 播放一个拒绝音效或错误音效
            if(window.playSound) window.playSound('click'); 
            return; // 直接中断
        }
        const pName = person.personality.name;
        
        // 基础门槛
        let favorReq = cfg.BASE_FAVOR_REQ;
        let loveReq = cfg.BASE_LOVE_REQ;

        // 性格门槛修正
        if (pName === "清贵") { 
            favorReq = cfg.NOBLE.FAVOR; 
            loveReq = cfg.NOBLE.LOVE; 
        }
        if (pName === "市侩") { 
            favorReq = cfg.MARKET.FAVOR; 
            loveReq = cfg.MARKET.LOVE; 
        }
        if (pName === "痴绝") { 
            favorReq = cfg.OBSESSED.FAVOR; 
            loveReq = cfg.OBSESSED.LOVE;} // 倒贴

        let success = (person.favor >= favorReq && person.love >= loveReq) || person.isSoulMate;
        
        // 清贵还要看修为，如果你比他弱太多，不行
       if (pName === "清贵" && gameState.player.power < person.power * cfg.NOBLE.POWER_RATE && !person.isSoulMate) {
            success = false;
        }

        if (success) {
            // 1. 先把其他人也就是前任的标记清理掉 (保持你原有的逻辑)
            gameState.npcs.forEach(n => {
                n.isSpouse = false;
                // 【建议新增】防止前任还记着你，清理前任的 spouseId
                if (n.spouseId === gameState.player.id) n.spouseId = null; 
            });

            // 2. 玩家绑定 NPC
            gameState.spouseId = person.id;
            gameState.player.isSpouse = true; 
    gameState.player.spouseId = person.id;
            // 3. NPC 绑定玩家
            person.isSpouse = true;             // 保留原有的标记
            person.spouseId = gameState.player.id; // 【关键修复】必须加上这一句！让 NPC 知道老公是你

            // 4. 日志与履历
            addLog(`【喜讯】你向 ${linkName(person)} 提亲，对方欣然应允！`, "#8e44ad");
            History.record(person, 'love', `与 [${gameState.player.name}] 喜结连理，正式结为道侣。`);
            History.record(gameState.player, 'love', `与 [${person.name}] 结为道侣，许下共度仙途的誓言。`);
            
            // 【可选优化】结婚后好感度通常会暴涨
           changeEmotion(person, 'love', cfg.MARRIAGE_BONUS);
            changeEmotion(person, 'favor', cfg.MARRIAGE_BONUS);
        } else {
            changeEmotion(person, 'favor', cfg.REJECT_FAVOR_LOSS);
            let reason = "";
            if (pName === "清贵") reason = "（似乎嫌弃你修为/家世不够）";
            if (pName === "市侩") reason = "（似乎觉得聘礼不够诚意）";
            
            addLog(`【被拒】${linkName(person)} 婉拒了你。${reason}`, "#7f8c8d");
            History.record(person, 'social', `婉拒了 [${gameState.player.name}] 的结缘请求。`);
            History.record(gameState.player, 'social', `向 [${person.name}] 提亲惨遭拒绝，场面一度十分尴尬。`);
        }
    }
});

// --- 劝说菜单 (Persuade Menu) ---
ActionManager.register({
    id: 'persuade_menu',
    cost: G_CONFIG.ACTIONS.PERSUADE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.PERSUADE;
        let m = findMediator(person);
        let options = "请选择化解仇怨的方式：\n1. 普通劝说 (看脸)\n2. 苦肉计 (自损修为，高成功率)";
        if (m) options += `\n3. 请说客 [${m.name}] 出面`;
        
        let choice = prompt(options, "1");
        if (choice === "1") handlePersuasion(person, 'normal');
        else if (choice === "2") handlePersuasion(person, 'sacrifice');
        else if (choice === "3" && m) handlePersuasion(person, 'mediator', m);
        else {
            gameState.player.ap += cfg.COST; 
            addLog("你斟酌良久，最终没有开口。", "#7f8c8d");
        }
    }
});

// --- 枕榻销怨 (数值逻辑升级版) ---
ActionManager.register({
    id: 'bond_resolve',
    cost: G_CONFIG.ACTIONS.BOND_RESOLVE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.BOND_RESOLVE;
        const pregCfg = G_CONFIG.PREGNANCY;
        // 1. 孕期检查
        if (person.pregnancyProgress > 0) {
            let isPlayerChild = (person.childParentId === gameState.player.id); 
            let msg = Text.Dialogue.getPregnancyRefusal(person, isPlayerChild);
            addLog(`【拒绝】${linkName(person)} 避开了你的靠近。${msg}`, "#e67e22");
             History.record(person, 'social', `因身怀六甲，愤怒拒绝了 [${gameState.player.name}] 的靠近。`);
            History.record(gameState.player, 'social', `试图靠近 [${person.name}] ，却被怒目而视，只好讪讪放弃。`);
            return;
        }
        
        // 2. 成功门槛 (性格修正)
        let pName = person.personality.name;
        let threshold = cfg.THRESHOLD_DEFAULT; 
        
        if (pName === "疏狂") threshold = cfg.THRESHOLD_EASY;
        if (pName === "清贵" || pName === "守心") threshold = cfg.THRESHOLD_HARD;

        if (person.love > threshold) {
            // === 成功逻辑 ===
            person.isNemesis = false;
            if (person.favor < 0) {
                person.favor = 20; 
            } else {
                changeEmotion(person, 'favor', cfg.FAVOR_GAIN); // 原来的加分逻辑
            }
            let flavorText = `一夜荒唐后，${linkName(person)} 神色复杂：“罢，这辈子算我欠你的。”`;
            if (pName === "痴绝") flavorText = `他紧紧抱住你，自嘲道：“我果然无法真正对你生气。”`;

            addLog(`【灵肉合一】${flavorText}`, "#e91e63");
            History.record(person, 'love', `与仇敌 [${gameState.player.name}] 一夜荒唐，心中本不该放下的仇恨竟随之消散。`);
            History.record(gameState.player, 'love', `用身体征服了仇敌 [${person.name}]，成功化解了这段恩怨。`);
            
            // 怀孕
            if (Math.random() < G_CONFIG.CHANCE.PREGNANCY) {
                const dCfg = G_CONFIG.DURATION;
                person.pregnancyProgress = dCfg.PREGNANCY_INIT; 
                person.birthTarget = randomInt(dCfg.PREGNANCY_MIN, dCfg.PREGNANCY_MAX);
                person.childParentId = gameState.player.id; 
                addLog(`（虽然仇恨散去，但似乎种下了新的“孽缘”...）`, "#9b59b6");
                History.record(person, 'life', `在与 [${gameState.player.name}] 的一夜荒唐后，意外怀上了身孕。`);
                History.record(gameState.player, 'life', `与 [${person.name}] 荒唐之后，却不知竟意外让对方珠胎暗结。`);
            }
            changeEmotion(person, 'favor', cfg.FAVOR_GAIN);
            changeEmotion(person, 'love', cfg.LOVE_GAIN);
        } else {
            // === 失败 ===
            let failMsg = `“拿开你的脏手，我宁愿自绝于此，也不受这份屈辱！”`;
            if (pName === "清贵") failMsg = `“你以为我是什么人？滚！”`;
            
            addLog(`${linkName(person)} 厌恶地推开你：${failMsg}`, "#c0392b");
            History.record(person, 'battle', `面对 [${gameState.player.name}] 的羞辱，宁死不从。`);
            History.record(gameState.player, 'battle', `试图强行化解与 [${person.name}] 的仇怨，但遭到了激烈的反抗。`);
        }
    }
});
// --- 强行 (数值逻辑升级版) ---
ActionManager.register({
    id: 'force_baby',
    cost: G_CONFIG.ACTIONS.FORCE_BABY.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.FORCE_BABY;
        const p = gameState.player;
        const dCfg = G_CONFIG.DURATION;

        // ================================================
        // 1. 战力判定 (含 R18 特质修正)
        // ================================================
        
        // 获取特质加成
        let r18Bonus = { expRate: 1.0, successRate: 0, desc: [] };
        if (window.R18 && window.R18.getTraitBonus) {
            r18Bonus = window.R18.getTraitBonus(person);
        }

        // 计算对方的抵抗战力
        // 逻辑：如果 successRate 是 20，说明他抵抗力下降 20%，只需原战力的 80% 就能推倒
        let resistFactor = Math.max(0.1, 1.0 - (r18Bonus.successRate / 100)); // 最低保留10%战力
        let targetPower = person.power * resistFactor;

        // 判定胜负
        if (p.power <= targetPower) {
            // --- 失败分支 ---
            addLog(`你试图强行占有 [${person.name}]，却被对方一掌击退！(战力差距: ${p.power} vs ${Math.floor(targetPower)})`, "#e74c3c");
            changeEmotion(person, 'favor', -20);
            changeEmotion(person, 'love', -10);
            changeEmotion(person, 'darkness', 5);
            // 挨打受伤逻辑
            p.power = Math.max(0, p.power - Math.floor(person.power * 0.5));
            return; // ★ 失败直接结束，不执行后面
        }

        // ================================================
        // 2. 成功分支：开始执行强行逻辑
        // ================================================

        // 越级挑战成功的特殊提示
        if (person.power > p.power) {
            // 说明是因为特质修正才赢的
            addLog(`[${person.name}] 本欲反抗，但羞耻的身体背叛了他，因【${r18Bonus.desc.join(", ")}】而瘫软在你怀里...`, "#e91e63");
        }

        // 变量初始化
        const isSpouse = (gameState.spouseId === person.id);
        const pName = person.personality.name;

        // 数值惩罚与性格修正
        let favorLoss = cfg.NORMAL_FAVOR_LOSS;
        let darknessGain = cfg.NORMAL_DARK_GAIN;
        let loveChange = 0;

        if (pName === "痴绝") {
            favorLoss = cfg.OBSESSED_FAVOR_LOSS;
            loveChange = cfg.OBSESSED_LOVE_GAIN;
            darknessGain = cfg.OBSESSED_DARK_GAIN;
        } else if (pName === "清贵" || pName === "守心") {
            favorLoss = cfg.NOBLE_FAVOR_LOSS;
            darknessGain = cfg.NOBLE_DARK_GAIN;
        }

        changeEmotion(person, 'favor', favorLoss);
        changeEmotion(person, 'darkness', darknessGain);
        if (loveChange !== 0) changeEmotion(person, 'love', loveChange);

        // 怀孕判定
        let pregChance = G_CONFIG.CHANCE.FORCE_PREGNANCY || 0.5;
        let isPregnant = Math.random() < pregChance;

        if (p.buffs && p.buffs.next_sure) {
            isPregnant = true;
            delete p.buffs.next_sure;
            addLog("【药效触发】受孕丹生效，此番必中！", "#e91e63");
        }

        if (isPregnant) {
            person.pregnancyProgress = dCfg.PREGNANCY_INIT; 
            person.birthTarget = randomInt(dCfg.PREGNANCY_MIN, dCfg.PREGNANCY_MAX);
            person.childParentId = p.id;
        }

        // --- 强行采补修为 (R18 增强版) ---
        // 基础公式：60 + 对方1.5% + 魅力x3
        let cultivation = 60 + (person.power * 0.015) + (p.charm * 3);

        // 心魔加成
        if (p.buffs && p.buffs.xin_mo_yu) {
            let bonus = Math.floor(cultivation * 0.6); 
            cultivation += bonus;
            addLog(`【心魔狂欢】你体内的魔念因这暴虐的占有而疯狂颤栗！(修为额外 +${bonus})`, "#e91e63");
        }

        // ★★★ R18 特质经验加成 (新增) ★★★
        if (r18Bonus.expRate > 1.0) {
            cultivation = Math.floor(cultivation * r18Bonus.expRate);
            addLog(`🔥 [肉体加成] 因对方体质淫靡，采补效率大幅提升！(x${r18Bonus.expRate.toFixed(1)})`, "#e67e22");
        }

        p.power += Math.floor(cultivation);
        addLog(`【采补】你强行掠夺了对方的元阴/元阳，修为增加 ${Math.floor(cultivation)} 点。`, "#2ecc71");

        // --- R18 逻辑注入：元阳与开发 (强行版) ---
        if (window.R18 && gameState.settings.enableR18) {
            // 尝试夺取元阳
            let yangResult = window.R18.checkPrimalYang(person);
            if (yangResult.success) {
                addLog(yangResult.msg, "#e67e22");
            }
            // 身体开发 (强度 3)
            let devMsg = window.R18.developBody(person, 3); 
            if (devMsg) addLog(`[身体变化] ${devMsg}`, "#e91e63");
        }

        // --- 文案与日志 ---
        let text = Text.Dialogue.getWoohoo(person, isSpouse, gameState.spouseId, true);
        addLog(`${text}`, "#800080");

        if (gameState.settings.enableR18) {
            // 旧版日志
            const oldLog = Text.Dialogue.getR18Log(person);
            if (oldLog) addLog(`[秘] ${oldLog}`, "#800000");

            // 新版动态特写
            if (window.R18 && window.R18.getDynamicSexLog) {
                const dynamicLog = window.R18.getDynamicSexLog(person, 'rough');
                if (dynamicLog) addLog(dynamicLog, "#c0392b");
            }
        }

        // 历史记录
        History.record(person, 'battle', `遭遇 [${p.name}] 强迫，留下了难以磨灭的阴影。`);
        History.record(p, 'battle', `强行霸占了 [${person.name}]。`); 
    }
});

// --- 双修/互动 (Baby Action) ---
ActionManager.register({
    id: 'baby',
    cost: G_CONFIG.ACTIONS.BABY.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.BABY;
        const p = gameState.player;
        const dCfg = G_CONFIG.DURATION;
        const isSpouse = (gameState.spouseId === person.id);

        // 1. 拦截检查
        if (isRelated(p, person)) {
    // 如果是血亲，检查是否满足“赦免条件”：
    // 条件：对方是灵魂伴侣(isSoulMate) OR 对方已被驯服归顺(isStockholm)
    if (person.isSoulMate || person.isStockholm) {
        // 允许通过，不进行 return 拦截
    } else {
        addLog(`【伦理禁忌】你与 ${person.name} 血脉相连，不可行此苟且之事！`, "#c0392b");
        return;
    }
        }
        if (person.pregnancyProgress > 0) {
            addLog(`${linkName(person)} ${Text.Dialogue.getWoohooRefusal(person)}`, "#e67e22");
            return;
        }

        // 2. 判定逻辑
        let stats = person.personality.stats || { moral: 50, desire: 50 };
        let resistance = stats.moral - stats.desire;
        if (isSpouse) resistance -= cfg.SPOUSE_RESISTANCE_REDUCE;
        if (person.love > cfg.DEEP_LOVE_LIMIT) resistance -= cfg.DEEP_LOVE_RESISTANCE_REDUCE;
        
        let success = (person.love > resistance) || (resistance < 0) || person.isSoulMate || person.isStockholm;

        if (success) {
            // ==========================================
            // 1. 数值计算与结算层 (严格保留原公式)
            // ==========================================
            
            // (1) 基础双修经验公式
            let cultivation = 50 + (person.power * 0.01) + (p.charm * 2);
            
            // (2) 心魔加成逻辑 (R18)
            if (p.buffs && p.buffs.xin_mo_yu) {
                let bonus = Math.floor(cultivation * 0.5); 
                cultivation += bonus;
                addLog(`【心魔欢愉】体内的欲念疯狂吞噬着交合产生的元气！(修为额外 +${bonus})`, "#e91e63");
            }
            
            // (3) R18 特质倍率计算
            let r18Bonus = { expRate: 1.0, desc: [] };
            if (window.R18 && window.R18.getTraitBonus) {
                r18Bonus = window.R18.getTraitBonus(person);
            }
            if (r18Bonus.expRate > 1.0) {
                cultivation = Math.floor(cultivation * r18Bonus.expRate);
            }

            // (4) 特质加成文案准备
            let r18LogText = "";
            if (r18Bonus.expRate > 1.0) {
                r18LogText = `<br><span style="color:#e67e22; font-size:12px;">🔥 [肉体加成] 由于【${r18Bonus.desc.join(", ")}】，修炼效率大幅提升！(x${r18Bonus.expRate.toFixed(1)})</span>`;
            }

            // (5) 最终结算修为 (同步 & 刷新)
            let finalVal = Math.floor(cultivation);
            p.power += finalVal;
            if (p.maxPower !== undefined && p.power > p.maxPower) {
                p.maxPower = p.power; 
            }
            if (window.gameState && window.gameState.player) {
                window.gameState.player.power = p.power;
            }
            if (typeof updateUI === 'function') updateUI();
            else if (typeof window.updateUI === 'function') window.updateUI();

            // ==========================================
            // 2. 轨迹一：数值报告 (绿色)
            // ==========================================
            addLog(`【双修】阴阳调和，你的修为增加了 ${finalVal} 点。${r18LogText}`, "#2ecc71");

            // ==========================================
            // 3. 药物与怀孕逻辑层 (保留原原本本的所有药效日志)
            // ==========================================
            let pregChance = G_CONFIG.CHANCE.PREGNANCY || 0.3;
            let isPregnant = Math.random() < pregChance;
            
            if (p.buffs && p.buffs.next_sure) {
                isPregnant = true;
                delete p.buffs.next_sure;
                addLog("【药效触发】受孕丹生效，此番必中！", "#e91e63");
            }
            
            if (isPregnant) {
                person.pregnancyProgress = dCfg.PREGNANCY_INIT; 
                person.birthTarget = randomInt(dCfg.PREGNANCY_MIN, dCfg.PREGNANCY_MAX);
                person.childParentId = p.id;
                // 多子丸日志
                if (p.buffs && p.buffs.next_multi) addLog("【药效预告】多子丸正在发挥效力...", "#e91e63");
            }

            // ==========================================
            // 4. 文案输出层 (红帐/普通对话)
            // ==========================================
            let specialText = Text.getSpecialDialogue ? Text.getSpecialDialogue(person, "romance") : null;
            if (specialText) {
                addLog(`红帐落下。[${linkName(person)}] ${specialText}`, "#e91e63");
            } else {
                addLog(`${Text.Dialogue.getWoohoo(person, isSpouse, gameState.spouseId, false)}`, "#e91e63");
            }

            // ==========================================
            // 5. 轨迹二：沉浸式交互层 (HTML卡片 + 两次开发结算)
            // ==========================================
            if (gameState.settings.enableR18 && window.R18) {
                // (1) 【第一次开发结算】：全局/随机开发
                let yangResult = window.R18.checkPrimalYang(person);
                if (yangResult.success) {
                    addLog(yangResult.msg, "#e67e22");
                }
                let devMsg = window.R18.developBody(person, 1); 
                if (devMsg) addLog(`[身体变化] ${devMsg}`, "#e91e63");

                // (2) 长剧情文案卡片
                let fullScene = "";
                if (window.R18.generatePaPaLog) {
                    fullScene = window.R18.generatePaPaLog(person, 'gentle');
                } else {
                    fullScene = Text.Dialogue.getWoohoo(person, true, gameState.spouseId);
                }

                let logHtml = `
                    <div style="padding:8px; border-left:3px solid #e91e63; background:rgba(233,30,99,0.05); margin:5px 0; border-radius: 0 5px 5px 0;">
                        <div style="font-size:14px; color:#444; margin-bottom:6px; line-height:1.5;">${fullScene}</div>
                        <div style="font-size:11px; color:#999; border-top:1px dashed #eee; padding-top:4px;">(点击查看详细肉体变化)</div>
                    </div>
                `;
                addLog(logHtml);

                // (3) 原版 R18 日志 [秘] (原原本本保留)
                const oldLog = Text.Dialogue.getR18Log(person); 
                if (oldLog) addLog(`[秘] ${oldLog}`, "#800000");

                // (4) 【第二次开发结算】：精准部位特写开发
                if (window.R18.getDynamicSexLog) {
                    const dynamicLog = window.R18.getDynamicSexLog(person, 'gentle');
                    if (dynamicLog) addLog(dynamicLog, "#e91e63"); 
                }
            }

            // ==========================================
            // 6. 状态变更与履历 (严格保留)
            // ==========================================
            p.lastLoverId = person.id;
            changeEmotion(person, 'favor', cfg.SUCCESS_FAVOR_GAIN);
            changeEmotion(person, 'love', cfg.SUCCESS_LOVE_GAIN);

            const relText = isSpouse ? "道侣" : "情缘";
            History.record(person, 'love', `与 [${p.name}] 共度良宵。`);
            History.record(p, 'love', `与 [${person.name}] 缠绵悱恻。`);
        } else {
            const tCfg = G_CONFIG.THRESHOLD;
            let reason = (stats.moral > tCfg.WOOHOO_MORAL_HIGH) ? "(对方道心坚定)" : "(对方兴致缺缺)";
            addLog(`${linkName(person)} ${Text.Dialogue.getWoohooRefusal(person)} ${reason}`, "#7f8c8d");
            changeEmotion(person, 'favor', cfg.REFUSE_FAVOR_LOSS);
        }
    }
});

// --- 离婚 (数值逻辑升级版) ---
ActionManager.register({
    id: 'divorce',
    cost: G_CONFIG.ACTIONS.DIVORCE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.DIVORCE;
        // 1. 获取数值
        let stats = person.personality.stats || { devotion: 50 };
        let pName = person.personality.name;

        // 2. 拒离判定条件
        let refuse = false;
        
        if (pName === "痴绝") refuse = true;
        if (stats.devotion > cfg.REFUSE_DEVOTION_LIMIT) refuse = true;
        if (person.love > cfg.REFUSE_LOVE_LIMIT && person.power > gameState.player.power) refuse = true;

        if (refuse) {
            // === 拒绝离婚 ===
            let msg = Text.Dialogue.getDivorceRefusal(person);
            // 黑化值激增
          changeEmotion(person, 'darkness', cfg.REFUSE_DARK_BASE + randomInt(0, cfg.REFUSE_DARK_VAR)); 
            addLog(`【离婚失败】你提出协议离婚，但 ${linkName(person)} 反应激烈！${msg}`, "#c0392b");
            History.record(person, 'love', `拒绝了 [${gameState.player.name}] 的离婚请求，执念深重。`);
            History.record(gameState.player, 'love', `提出离婚，却被 [${person.name}] 强烈反对，未能如愿。`);
        } else {
            // === 同意离婚 ===
            let msg = Text.Dialogue.getBreakup(person, 'divorce');
            
            // 1. 玩家侧清理
            gameState.spouseId = null;
            gameState.player.isSpouse = false; // 必须增加这一行
gameState.player.spouseId = null;  // 建议同步清理玩家对象内的配偶ID
            // 2. NPC 侧清理 (这三行是新增的关键修复)
            person.isSpouse = false;      // 标记他不再是你的配偶
            person.spouseId = null;       // 标记他心里也没有配偶了
            delete person.status;         // 删除写死的 "已婚" 状态文本，让UI重新计算
            
            // 由爱生恨：好感爱意归零，甚至变负
           person.favor = cfg.SUCCESS_FAVOR;
            person.love = 0;
            
            // 如果是市侩，可能会说点难听的
          if(["痴绝", "市侩"].includes(pName)) {
                changeEmotion(person, 'darkness', cfg.SUCCESS_DARK_OBSESSED);
            }

            addLog(`【缘尽】你提出协议离婚。${linkName(person)} ${msg}`, "#7f8c8d");
            History.record(person, 'love', `与 [${gameState.player.name}] 缘分已尽，协议离异。`);
            History.record(gameState.player, 'love', `与 [${person.name}] 感情破裂，协议离婚。`);
        }
    }
});

// --- 强行休妻/夫 (数值逻辑升级版) ---
ActionManager.register({
    id: 'divorce_force',
    cost: G_CONFIG.ACTIONS.DIVORCE.COST,
    run: (person) => {
        const cfg = G_CONFIG.ACTIONS.DIVORCE;
        // 1. 获取性格与数值
        let pName = person.personality.name;
        let stats = person.personality.stats || { devotion: 50 };

        // 2. 获取分手文案
        let msg = Text.Dialogue.getBreakup(person, 'divorce_force');
        
        // 3. 执行强制离婚逻辑
        gameState.spouseId = null;
        gameState.player.isSpouse = false; // 增加玩家状态清理
gameState.player.spouseId = null;  // 增加玩家状态清理
        // --- 修复开始 ---
        person.isSpouse = false;
        person.spouseId = null;       // 必须清空，否则他不仅显示已婚，下回合还可能触发夫妻互动
        delete person.status;         // 移除固定NPC可能存在的硬编码状态
        // --- 修复结束 ---
        // 4. 数值惩罚挂钩
        // 基础惩罚
       let favorLoss = cfg.FORCE_FAVOR_LOSS;
        let darknessGain = cfg.FORCE_DARK_GAIN;

        // --- 性格差异化 ---
        // A. 痴绝：直接疯魔，黑化值拉满
        if (pName === "痴绝") {
           darknessGain = cfg.OBSESSED_DARK;
            favorLoss = cfg.OBSESSED_FAVOR;
            msg += "\n(警告：对方黑化值已达顶峰，极度危险！)";
        }
        // B. 清贵：视尊严如命，好感度跌至谷底
        else if (pName === "清贵") {
            favorLoss = cfg.NOBLE_FAVOR;// 奇耻大辱
        }
        // C. 情义值高的人：因爱生恨，黑化更多
       if (stats.devotion > cfg.REFUSE_DEVOTION_LIMIT) {
            darknessGain += cfg.DEVOTION_EXTRA_DARK;
        }

        changeEmotion(person, 'favor', favorLoss); 
        changeEmotion(person, 'darkness', darknessGain);
        person.love = 0; 
        person.isNemesis = true; // 必然结仇

        addLog(`【休书】你凭借强大的修为，强行将 ${linkName(person)} 休弃！${msg}`, "#c0392b");
        
        History.record(person, 'love', `被 [${gameState.player.name}] 强行休弃，受尽屈辱，誓要复仇。`);
        History.record(gameState.player, 'love', `一纸休书，强行休弃了 [${person.name}]，恩断义绝。`);
    }
});

// 1. 定义一个变量，用来记住当前正在跟谁论道
let currentDaoTarget = null;

// 2. 注册动作：只负责打开 UI，不负责结算
ActionManager.register({
    id: 'discuss_dao', 
    cost: 0, // 打开界面不耗精力，点了确定才耗
    run: (person) => {
        currentDaoTarget = person; // 记住目标
        
        // 更新弹窗上的名字
        let nameEl = document.getElementById('dao-target-name');
        if (nameEl) nameEl.innerText = `正在与 [${person.name}] 论道，欲行何事？`;
        
        // 显示弹窗
        let modal = document.getElementById('dao-modal');
        
        if (modal) {
            // ▼▼▼▼▼▼ 新增：层级置顶逻辑 ▼▼▼▼▼▼
            // 我们借用 ui.js 里的 globalZIndex 计数器，让自己比人物卡片更高
            if (typeof window.globalZIndex !== 'undefined') {
                window.globalZIndex++; 
                modal.style.zIndex = window.globalZIndex;
            } else {
                // 如果找不到计数器，就给个无敌的数字兜底
                modal.style.zIndex = 99999;
            }
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
            
            modal.style.display = 'flex';
        }
    }
});

// 3. 定义关闭弹窗的函数 (挂载到 window，给 HTML 的 X 按钮用)
window.closeDaoModal = function() {
    let modal = document.getElementById('dao-modal');
    if (modal) modal.style.display = 'none';
    currentDaoTarget = null;
};

// 4. 定义核心逻辑函数 (挂载到 window，给那 6 个按钮用)
window.confirmDao = function(choiceType) {
    if (!currentDaoTarget) return; // 如果没目标，不执行
    const cfg = G_CONFIG.ACTIONS.DISCUSS_DAO;
    const dCfg = G_CONFIG.DAO_MODIFIER;
    let person = currentDaoTarget;
    let choice = choiceType.toString();
let cost = Number(cfg.COST || 0);
    let currentAP = Number(gameState.player.ap || 0);

    // === 映射表：每个按钮对应的效果 ===
    const EFFECTS = {
        "1": { stat: 'moral',    dir: 1,  name: '点化', desc: '明悟天道守序' },
        "2": { stat: 'moral',    dir: -1, name: '蛊惑', desc: '堕入唯我魔道' },
        "3": { stat: 'devotion', dir: 1,  name: '感化', desc: '领悟羁绊之重' },
        "4": { stat: 'devotion', dir: -1, name: '离间', desc: '看透世态炎凉' },
        "5": { stat: 'desire',   dir: 1,  name: '利诱', desc: '释放内心贪欲' },
        "6": { stat: 'desire',   dir: -1, name: '苦行', desc: '追求清静无为' }
    };

    let op = EFFECTS[choice];
    if (!op) return;

    // === 智力对抗逻辑 ===
    // 改变"情义(devotion)"通常比改变"道德"更容易，给一点加成
    let bonus = (op.stat === 'devotion') ? cfg.DEVOTION_BONUS : 1.0;
    
    // 玩家骰子 vs NPC 骰子
   let playerRoll = gameState.player.int * (cfg.INT_ROLL_MIN + Math.random() * cfg.INT_ROLL_RANGE) * bonus;
    let npcRoll = person.int * (cfg.INT_ROLL_MIN + Math.random() * cfg.INT_ROLL_RANGE);
    // === 骨相难度修正 (Dao Check) ===
    let pDao = person.personality.dao;
    let pName = person.personality.name;
   if (pDao === 'realist' && (choice === "1" || choice === "6")) npcRoll *= dCfg.REALIST_DEFENSE;
    if (pName === '痴绝' && choice === "4") npcRoll *= dCfg.OBSESSED_DEFENSE;
    if (pName === '守心' && choice === "2") npcRoll *= dCfg.PURE_HEART_DEFENSE;
    // === 结算结果 ===
    if (playerRoll > npcRoll) {
        // --- 成功 ---
        let change = randomInt(cfg.CHANGE_BASE_MIN, cfg.CHANGE_BASE_MAX); 
        let targetStat = person.personality.stats;
        
        targetStat[op.stat] = Math.max(0, Math.min(100, targetStat[op.stat] + (change * op.dir)));
        // ▼▼▼▼▼▼ 修改开始：中文名与模糊化 ▼▼▼▼▼▼
        
        // 1. 定义中文属性名
        const CN_STATS = {
            'moral': '道德',
            'devotion': '情义',
            'desire': '欲望'
        };
        let statName = CN_STATS[op.stat];
        
        // 2. 定义变动描述 (更精准的词汇)
        // 结构: { up: 增加时的描述, down: 减少时的描述 }
        const TEXT_MAP = {
            'moral':    { up: '有所精进', down: '有所动摇' },  // 道德
            'devotion': { up: '愈发深重', down: '逐渐淡漠' },  // 情义
            'desire':   { up: '愈发强烈', down: '逐渐消减' }   // 欲望
        };

        // 根据加减方向，取对应的词
        let changeText = op.dir > 0 ? TEXT_MAP[op.stat].up : TEXT_MAP[op.stat].down;

        // 3. 日志：现在使用文字描述了 (去掉了空格，更紧凑)
        // 效果：(道德有所精进) / (欲望愈发强烈)
        addLog(`你对 ${person.name} 进行【${op.name}】，对方心神巨震！(${statName}${changeText})`, "#e67e22");
        
        // 4. 履历：保持一致
        History.record(person, 'psychology', `听了 ${gameState.player.name} 的【${op.name}】之言，${op.desc}。(${statName}${changeText})`);

        // 额外奖励逻辑不变
        if (choice === "3") changeEmotion(person, 'favor', 5);
        if (pDao === 'seeker') changeEmotion(person, 'favor', 3);

    } else {

        // --- 失败 ---
        addLog(`你试图【${op.name}】${person.name}，但对方根本听不进去，反而觉得你强词夺理。`, "#7f8c8d");
        
        // 履历
        History.record(person, 'social', `对 ${gameState.player.name} 的【${op.name}】之语嗤之以鼻。`);
        History.record(gameState.player, 'social', `试图【${op.name}】${person.name} 失败，反被奚落。`);
        
        // 失败惩罚：扣好感
     let favorLoss = (pDao === 'realist') ? cfg.FAIL_FAVOR_REALIST : cfg.FAIL_FAVOR_NORMAL;
        changeEmotion(person, 'favor', favorLoss);
    }
    
    // 刷新界面显示最新数值
    updateUI();
    if (gameState.selectedPersonId) openDetail(gameState.selectedPersonId);
    window.closeDaoModal();
};
// 辅助：尝试解锁地图
function tryRevealMap(npc) {
    // 1. 如果NPC没有所属宗门，或者他的宗门就是玩家的宗门，或者已经是公开地点
    if (!npc.homeSect || npc.homeSect === 'sect' || npc.homeSect === 'market' || npc.homeSect === 'wild') return;

    // 2. 检查玩家是否已经解锁了这个地方
    if (gameState.unlockedLocations.includes(npc.homeSect)) return;

    // 3. 触发解锁！
    gameState.unlockedLocations.push(npc.homeSect);
    
    let sectName = getLocationName(npc.homeSect);
    
    // 弹窗或日志提示
    addLog(`【地图解锁】${npc.name} 向你透露了其宗门<strong>【${sectName}】</strong>的具体方位！`, "#e67e22");
    alert(`🗺️ 新地图解锁！\n\n经过与 ${npc.name} 的交流，你得知了 [${sectName}] 的位置。\n下次外出时可以前往了！`);
    
    // 播放个音效
    if(window.playSound) window.playSound('popup');
}
// [actions.js] Phase 3: 迷情香-强制互动
ActionManager.register({
    id: 'force_woohoo_charm',
    cost: G_CONFIG.ACTIONS.FORCE_CHARM.COST,
    run: (person) => {
        const p = gameState.player;
        const cfg = G_CONFIG.ACTIONS.FORCE_CHARM;
        const dCfg = G_CONFIG.DURATION;
        
        // 1. 数值比拼判定 (战力 或 智力 高于对方)
        // 迷情香状态下，判定门槛降低，只要你有一项比他强就行
        let canForce = (p.power > person.power) || (p.int > person.int);
        
        // 2. 结果分支
        if (canForce) {
            // === 成功霸王硬上弓 ===
            
            // a. 必然结怨 (既然是强行，肯定扣好感加黑化)
           changeEmotion(person, 'favor', cfg.FAVOR_LOSS_NORMAL); 
            changeEmotion(person, 'darkness', cfg.DARKNESS_GAIN_NORMAL);
            
            // 痴绝性格特殊反应：不怒反喜？
            if (person.personality.name === "痴绝") {
                changeEmotion(person, 'love', cfg.OBSESSED_LOVE_GAIN);
                addLog(`(迷情香) 即使是被迫，${linkName(person)} 眼中竟也闪过一丝扭曲的快意。`, "#9b59b6");
            } else {
                person.isNemesis = true; // 正常人直接变仇敌
            }

            // b. 怀孕判定 (检查受孕丹 Buff)
            // 基础概率 50% (迷情香加成) + Buff 修正
            let isPregnant = Math.random() < G_CONFIG.CHANCE.FORCE_PREGNANCY;
            if (p.buffs && p.buffs.next_sure) {
                isPregnant = true;
                delete p.buffs.next_sure; // 消耗受孕丹
                addLog("【药效触发】受孕丹生效，此番必中！", "#e91e63");
            }

            if (isPregnant) {
                person.pregnancyProgress = dCfg.PREGNANCY_INIT;
                // 检查多子丸 (Phase 4 才会实装具体的多胞胎逻辑，这里先埋个伏笔，或者简单处理)
                // 这里我们先按原逻辑生成 birthTarget
                person.birthTarget = randomInt(dCfg.PREGNANCY_MIN, dCfg.PREGNANCY_MAX);
                person.childParentId = p.id;
            }
// ▼▼▼▼▼▼▼▼▼▼▼▼ 新增：迷情香采补 + 心魔加成 ▼▼▼▼▼▼▼▼▼▼▼▼
            // 1. 药物助兴，收益也不错
            let cultivation = 55 + (person.power * 0.012) + (p.charm * 2.5);

            // 2. 心魔加成 (R18)
            if (p.buffs && p.buffs.xin_mo_yu) {
                let bonus = Math.floor(cultivation * 0.55);
                cultivation += bonus;
                addLog(`【心魔贪食】迷乱的药香与欲念让心魔大快朵颐！(修为额外 +${bonus})`, "#e91e63");
            }

            p.power += Math.floor(cultivation);
            addLog(`【双修】在药力作用下，你吸取了大量元气。修为 +${Math.floor(cultivation)}`, "#2ecc71");
           // ▼▼▼▼▼▼ R18 逻辑注入：元阳与三倍开发 (增强版) ▼▼▼▼▼▼
            if (window.R18 && gameState.settings.enableR18) {
                // 1. 尝试夺取元阳
                let yangResult = window.R18.checkPrimalYang(person);
                if (yangResult.success) {
                    addLog(yangResult.msg, "#e67e22");
                }

                // 2. 🟢【增强】连续开发 3 次！(大幅提高背德归顺的达成率)
                // 模拟迷情香下对方身体完全失控，被你肆意玩弄多处
                let devMsg1 = window.R18.developBody(person, 2); 
                let devMsg2 = window.R18.developBody(person, 2); 
                let devMsg3 = window.R18.developBody(person, 2);
                
                // 拼接日志，避免刷屏
                let parts = [];
                if(devMsg1) parts.push(devMsg1);
                if(devMsg2 && devMsg2 !== devMsg1) parts.push(devMsg2);
                if(devMsg3 && devMsg3 !== devMsg1 && devMsg3 !== devMsg2) parts.push(devMsg3);
                
                if (parts.length > 0) {
                    addLog(`[身体变化] 在药力催化下，${parts.join("、")} 等部位变得更加敏感淫靡...`, "#e91e63");
                }
            }
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
           addLog(`【迷情香】异香入骨，你趁着对方神志迷离，强行与其欢好！`, "#c0392b");

            if (gameState.settings.enableR18) {
                // 1. 旧版日志 (保留)
                let type = (p.buffs && p.buffs.xin_mo_yu) ? 'xin_mo' : 'drug';
                const oldLog = Text.Dialogue.getR18Log(person, type); 
                if (oldLog) addLog(`[秘] ${oldLog}`, "#800000");

                // 2. 新增：动态特写 (追加)
                if (window.R18) {
                    // charm = 迷乱模式
                    const dynamicLog = window.R18.getDynamicSexLog(person, 'charm');
                    if (dynamicLog) addLog(dynamicLog, "#9b59b6"); // 紫色
                }
            } else {
                // 没开 R18 的逻辑保持不变...
                let text = Text.Dialogue.getWoohoo(person, false, null, true); 
                addLog(`${text}`, "#800080");
            }
            
            History.record(person, 'battle', `在迷情香的作用下，遭到了 [${p.name}] 的强行侵犯。`);
            History.record(p, 'battle', `点燃迷情香，强行占有了 [${person.name}]。`);

        } else {
            // === 失败 (被反杀) ===
            addLog(`【失败】你试图借助药力强来，却被 ${linkName(person)} 一脚踹下床！(对方修为/定力深厚)`, "#7f8c8d");
            changeEmotion(person, 'favor', cfg.FAIL_FAVOR_LOSS);
            p.power = Math.max(0, p.power - cfg.FAIL_POWER_PENALTY);
        }
    }
});
// --- 神性威压 (浓度 > 60%) ---
ActionManager.register({
    id: 'divine_confiscate',
    cost: 1,
    run: (person) => {
        if (person.items.length > 0) {
            let itemList = person.items.join('、');
            gameState.player.items = gameState.player.items.concat(person.items);
            person.items = [];
            addLog(`你散发出恐怖的血脉威压，${linkName(person)} 浑身战栗，如供奉神明般献上了所有宝物。`, "#f1c40f");
            addLog(`(获得了: ${itemList})`, "#27ae60");
            History.record(person, 'life', `被天凤血脉震慑，身不由己地献出了所有随身物品。`);
        } else {
            addLog(`${linkName(person)} 身上已无物可献。`, "#7f8c8d");
        }
    }
});

// --- 宿命牵引 (浓度 > 80%) ---
ActionManager.register({
    id: 'divine_pull',
    cost: 2,
    run: (person) => {
        const oldLoc = getLocationName(person.location);
        person.location = gameState.player.location; // 强行拉过来
        const newLoc = getLocationName(person.location);
        addLog(`你拨动宿命之弦，原本远在 [${oldLoc}] 的 ${linkName(person)} 瞬间跨越山海，惊愕地出现在你面前。`, "#9b59b6");
        History.record(person, 'social', `被一股不可抗拒的神魂力量强行召唤到了 [${newLoc}]。`);
        updateUI(); // 必须立即刷新NPC列表
    }
});
// --- 勒索行动 ---
ActionManager.register({
    id: 'blackmail_relative',
    cost: 0,
    run: async (prisoner) => {
        const cfg = G_CONFIG.BLACKMAIL; // 调用配置
        const targets = window.getBlackmailTargets(prisoner);
        
        if (targets.length === 0) {
            addLog(`这名囚徒似乎已被世人遗忘，无人愿意为之出头。`, "#7f8c8d");
            return;
        }

        let targetListStr = targets.map((t, i) => `${i + 1}. ${t.name} (好感: ${t.relationships[prisoner.id] || 0})`).join('<br>');
        let targetIdx = await window.showModal("【选择勒索对象】", `以此人为饵，你想写信威胁谁？<br><br>${targetListStr}`, 'prompt', "1");
        let targetNPC = targets[parseInt(targetIdx) - 1];

        if (!targetNPC) return;

        let demandText = `
            你想对 <strong>${targetNPC.name}</strong> 提出什么要求？<br><br>
            1. <strong>金帛赎身</strong> (索要${cfg.MONEY_DEMAND}灵石)<br>
            2. <strong>断缘休书</strong> (强迫其离婚)<br>
            3. <strong>肉身代偿</strong> (强迫其共度春宵)<br>
            4. <strong>指婚拉郎</strong> (强迫其与他人结婚)
        `;
        let demandType = await window.showModal("【提出过分条件】", demandText, 'prompt', "1");

        // 使用配置中的系数进行判定
        let relValue = targetNPC.relationships[prisoner.id] || 0;
        let successChance = (relValue * cfg.SUCCESS_COEFF.RELATION) + 
                            (gameState.player.int * cfg.SUCCESS_COEFF.INTEL) + 
                            (gameState.player.power / targetNPC.power * cfg.SUCCESS_COEFF.POWER);
        
        let isSuccess = Math.random() * 100 < successChance;

        if (isSuccess) {
            if (demandType === "1") {
                targetNPC.spiritStones -= cfg.MONEY_DEMAND;
                gameState.player.spiritStones += cfg.MONEY_DEMAND;
                addLog(`在威胁之下，${linkName(targetNPC)} 忍痛献上了积攒的灵石以换取人质的平安。`, "#f1c40f");
            } else if (demandType === "2") {
                targetNPC.spouseId = null;
                targetNPC.isSpouse = false;
                addLog(`为了救回心中之人，${linkName(targetNPC)} 颤抖着签下了断缘书。`, "#e67e22");
            } else if (demandType === "3") {
                addLog(`眼神交错间，${linkName(targetNPC)} 闭上双眼，选择了屈服于这份羞辱。`, "#e91e63");
                // --- A. 修为采补 (新增) ---
                let cultivation = 80 + (targetNPC.power * 0.02) + (gameState.player.charm * 3);
                
                // 心魔加成
                if (gameState.player.buffs && gameState.player.buffs.xin_mo_yu) {
                    let bonus = Math.floor(cultivation * 0.8); // 这种极度胁迫的，心魔加成 80%
                    cultivation += bonus;
                    addLog(`【心魔狂欢】这种卑劣的胁迫让心魔兴奋得发抖！(修为额外 +${bonus})`, "#e91e63");
                }
                gameState.player.power += Math.floor(cultivation);
                addLog(`【采补】你强行索取了对方的元气，修为增加 ${Math.floor(cultivation)} 点。`, "#2ecc71");
                // ▼▼▼▼▼▼ R18 逻辑注入：元阳与开发 (勒索版) ▼▼▼▼▼▼
                if (window.R18 && gameState.settings.enableR18) {
                    // 1. 尝试夺取元阳 (注意变量名是 targetNPC)
                    let yangResult = window.R18.checkPrimalYang(targetNPC);
                    if (yangResult.success) {
                        addLog(yangResult.msg, "#e67e22");
                    }

                    // 2. 身体部位开发 (强度 2：屈辱)
                    let devMsg = window.R18.developBody(targetNPC, 2); 
                    if (devMsg) addLog(`[身体变化] ${devMsg}`, "#e91e63");
                }
                // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                // 反向受孕逻辑 (NPC怀孕)
                if (Math.random() < (cfg.PREGNANCY_CHANCE|| 0.5)) {
                   targetNPC.pregnancyProgress = 1; // 启动怀孕进度
                    targetNPC.birthTarget = randomInt(8, 10);
                    targetNPC.childParentId = gameState.player.id;
                    addLog(`(隐秘的种子已在 ${targetNPC.name} 体内悄然埋下)`, "#c0392b");
                }
// ▼▼▼ 新增：显示 R18 文案 ▼▼▼
                if (gameState.settings.enableR18) {
                    // 1. 如果有心魔，优先心魔
                    if (gameState.player.buffs && gameState.player.buffs.xin_mo_yu) {
                         // 这里假设你 text.js 里有 'xin_mo' 类型，如果没有就删掉这行判断
                         const r18Text = Text.Dialogue.getR18Log(targetNPC, 'xin_mo');
                         if (r18Text) addLog(`[秘] ${r18Text}`, "#800000");
                    } 
                    // 2. 否则，触发“勒索”专属 R18 文案
                    else {
                         const r18Text = Text.Dialogue.getR18Log(targetNPC, 'blackmail'); 
                         if (r18Text) addLog(`[秘] ${r18Text}`, "#800000");
                    }
                }
                // 沉沦判定：使用配置门槛
                if (gameState.player.charm > cfg.CHARM_THRESHOLD || Math.random() < 0.3) {
                    changeEmotion(targetNPC, 'love', cfg.LOVE_GAIN);
                    changeEmotion(targetNPC, 'darkness', cfg.DARKNESS_GAIN);
                    addLog(`${linkName(targetNPC)} 在沉沦中产生了一种病态的错觉，竟开始迷恋这份苦痛。`, "#9b59b6");
                } else {
                    changeEmotion(targetNPC, 'favor', -50); 
                }
            } else if (demandType === "4") {
                let randomMate = randomChoice(gameState.npcs.filter(n => n.id !== targetNPC.id));
                targetNPC.spouseId = randomMate.id;
                randomMate.spouseId = targetNPC.id;
                addLog(`你恶意地将 ${linkName(targetNPC)} 许配给了 ${linkName(randomMate)}。`, "#8e44ad");
            } else {
                    addLog(`你本想乱点鸳鸯谱，奈何周围竟无一人可用。`, "#7f8c8d");
                }
        } else {
            // 失败惩罚使用配置
            addLog(`${linkName(targetNPC)} 勃然大怒，试图强行劫狱！`, "#c0392b");
            if (gameState.player.power > targetNPC.power) {
                addLog(`你将试图营救的 ${linkName(targetNPC)} 一并锁入地牢。`, "#2c3e50");
                targetNPC.isImprisoned = true;
                targetNPC.location = gameState.player.location; // 确保位置同步
                if(window.updateUI) updateUI();
            } else {
                addLog(`失算了！${linkName(targetNPC)} 救走了人质，还顺势重伤了你。`, "#7f8c8d");
                prisoner.isImprisoned = false;
                let dmg = cfg.HP_PENALTY || 50;
                gameState.player.power = Math.max(0, gameState.player.power - dmg); 
                addLog(`【重伤】你的修为受损，减少了 ${dmg} 点。`, "#c0392b");
                if(window.updateUI) updateUI();
            }
        }
    }
});