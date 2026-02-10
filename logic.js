// logic.js
// 游戏核心机制与规则运算
// ----------------------------------------------------------------
import { gameState, findPerson } from './state.js';
import { DB, REALMS, LIFE_CAPS, PERSONAS, PERSONA_CATEGORIES } from './data.js';// <--- 记得加上 LIFE_CAPS
import { G_CONFIG } from './config.js';
import { History } from './history.js'; // <--- 新增
import { getLocationName,getTravelTime, LOCATIONS } from './locations.js'; // <--- 新增
import { playSound } from './audio.js';
import { Text } from './text.js';
import { createPerson, generatePersonality } from './factory.js';
import { addLog, linkName, randomInt, randomChoice, getRealmName, getSurname, generateName, getRealmRank, GeneService, Logger, isRelated } from './utils.js';
import { showModal, updateUI } from './ui.js'; // <--- 新增这一行
// --- 骨相权重计算引擎 (配置化 & 日志升级版) ---
export function getDaoWeight(person, type) {
    const cfg = G_CONFIG.DAO; // 引用配置
    
    // 1. 获取基础三维
    const stats = person.personality.stats || { moral: 50, devotion: 50, desire: 50 };
    const dao = person.personality.dao || "humanist";

    // 使用配置的基数进行标准化
    let m = stats.moral / cfg.STATS_BASE;
    let d = stats.devotion / cfg.STATS_BASE;
    let s = stats.desire / cfg.STATS_BASE;

    let weight = 1.0;

    // 2. 逻辑分支
    switch (dao) {
        case "seeker":
            if (type === 'righteousness') weight = 1.0 + m; 
            if (type === 'emotion') weight = cfg.SEEKER_EMOTION; 
            if (type === 'benefit') weight = 1.0;
            break;

        case "humanist":
            if (type === 'righteousness') weight = 1.0;
            if (type === 'emotion') weight = 1.0 + d;
            // 使用配置：0.8 - (s * 0.5)
            weight = cfg.HUMANIST_BENEFIT_BASE - (s * cfg.HUMANIST_BENEFIT_S_MULT);
            break;

        case "realist":
            if (type === 'righteousness') weight = cfg.REALIST_RIGHTEOUS;
            if (type === 'emotion') weight = cfg.REALIST_EMOTION;
            if (type === 'benefit') weight = 1.0 + s;
            break;
    }

    // 3. 统一使用 Logger 记录上帝视角调试信息
    // 这样以后你想发布游戏时，只需要在 utils.js 把 DEBUG_MODE 改为 false，这些乱七八糟的日志就全消失了
    Logger.info("DAO", `${person.name}(${dao}) | 类型:${type} | 数值:${stats.moral}/${stats.devotion}/${stats.desire} | 系数:x${weight.toFixed(2)}`);

    return parseFloat(weight.toFixed(2));
}
// [logic.js] 替换原有的 shouldLog 函数

// --- 辅助：判断是否值得记录日志 (战争迷雾系统) ---
function shouldLog(type, p1, p2 = null) {
    const player = gameState.player;
    
    // 1. 【自身相关】如果事件涉及主角，永远显示
    if (p1.id === player.id || (p2 && p2.id === player.id)) return true;
    
    // 2. 【亲友相关】如果事件涉及主角的道侣或子女，永远显示
    const importantIds = [gameState.spouseId, ...gameState.children.map(c=>c.id)];
    if (importantIds.includes(p1.id) || (p2 && importantIds.includes(p2.id))) return true;

    // 3. 【大新闻判定】震惊修真界的大事，不认识也能听到
    // 规则：元婴期及以上的大能突破或陨落，属于全服通告
    if (type === 'breakthrough' || type === 'birth' || type === 'death' || type === 'battle') {
        const p1High = getRealmRank(p1.power) >= 4; // 元婴及以上
        const p2High = p2 ? getRealmRank(p2.power) >= 4 : false;
        if (p1High || p2High) return true;
    }

    // 4. 【社交圈判定】只有“认识”的人的消息，才会传播到你耳中
    // "认识"的定义：好感度不为0 (聊过天/打过架)，或者在你的关系列表里
    const isKnown = (p) => {
        if (!p) return false;
        // 你的好感度不为0，或者你在对方的关系列表里
        return Math.abs(p.favor) > 0 || (p.relationships && p.relationships[player.id]);
    };

    if (isKnown(p1) || (p2 && isKnown(p2))) {
        // 即使认识，也得看设置开没开
        if (type === 'gossip') return gameState.settings.showGossip;
        if (type === 'battle') return gameState.settings.showBattle;
        if (type === 'birth') return gameState.settings.showBirth;
        return true;
    }

    // 5. 既不认识，也不是大能，那就是路人甲的噪音，过滤掉
    return false; 
}

// --- 情感变更引擎 (完全配置化版) ---
export function changeEmotion(target, type, value) {
    if (!target || !target.personality || !target.personality.params) return;

    // 1. 境界压制检查 (使用配置化数字)
    if ((type === 'favor' || type === 'love') && value > 0 && gameState.player) {
        let pRank = getRealmRank(gameState.player.power);
        let tRank = getRealmRank(target.power);
        let gap = tRank - pRank;

        // 如果境界差距过大 (>= 2)
        if (gap >= G_CONFIG.REALM.SUPPRESS_GAP) {
            let isFamily = (target.id === gameState.spouseId) || 
                           gameState.children.some(c => c.id === target.id) ||
                           (target.fatherId === gameState.player.id);
            
            // 非亲属且好感度不高 (>= 10) 时，极难提升好感
            if (!isFamily && target.favor >= G_CONFIG.REALM.COLD_FAVOR_LINE) {
                let breakChance = (gameState.player.charm + gameState.player.int) * G_CONFIG.REALM.BREAK_CHANCE_MULT;
                if (Math.random() > breakChance) return; 
            }
        }
    }

    const params = target.personality.params;
    let finalValue = value;

    // 2. 骨相修正逻辑
    if (value > 0) {
        let eventType = 'benefit'; 
        if (type === 'love' || type === 'favor_social') eventType = 'emotion';
        if (type === 'favor_righteous') eventType = 'righteousness';

        let daoMult = getDaoWeight(target, eventType);
        let oldValue = finalValue;
        finalValue = Math.floor(finalValue * daoMult);

        // 如果修正幅度达到阈值 (>= 2)，显示上帝视角日志
        if (Math.abs(oldValue - finalValue) >= G_CONFIG.EMOTION.LOG_THRESHOLD && gameState.player) {
            let gap = finalValue - oldValue;
            let icon = gap < 0 ? "📉" : "📈";
            addLog(`【上帝视角】由于某种原因，${target.name} 似乎与他表现得并不一致。好感 ${oldValue}→${finalValue} ${icon}`, "#4d4d4e");
        }

        // 统一使用 Logger 打印后台调试
        Logger.info("EMOTION", `${target.name} | 原始:${oldValue} -> 修正(x${daoMult}) -> 最终:${finalValue}`);
    }

    // 3. 归一化类型
    if (type.startsWith('favor')) type = 'favor';

    // 4. 应用最终数值
    if (type === 'favor') {
        if (value < 0) finalValue = value; // 扣分不享受骨相加成
        target.favor += finalValue;

        // 结仇判定 (使用之前的 THRESHOLD 配置)
        if (target.favor < G_CONFIG.THRESHOLD.HATE_NEMESIS && !target.isNemesis) {
            target.isNemesis = true;
            addLog(`【反目】${target.name} 对你的忍耐已达极限，从此视你为死敌！`, "#c0392b");
        }

        // 范围限制 (使用 LIMIT 配置)
        if (!target.isNemesis) {
            if (target.favor > G_CONFIG.LIMIT.MAX_FAVOR) target.favor = G_CONFIG.LIMIT.MAX_FAVOR;
            if (target.favor < G_CONFIG.LIMIT.MIN_FAVOR) target.favor = G_CONFIG.LIMIT.MIN_FAVOR;
        }
    }
    else if (type === 'love') {
        if (value > 0) finalValue = Math.floor(finalValue * params.loveRate);
        target.love += finalValue;
        
        // 使用配置的爱意范围
        if (target.love < G_CONFIG.EMOTION.MIN_LOVE) target.love = G_CONFIG.EMOTION.MIN_LOVE;
        if (target.love > G_CONFIG.EMOTION.MAX_LOVE) target.love = G_CONFIG.EMOTION.MAX_LOVE;
    }
    else if (type === 'darkness') {
        // 这里 params.darkTrigger 是每个 NPC 特有的性格敏感度系数，保留
        target.darkness += Math.floor(value * params.darkTrigger);
        if (target.darkness < 0) target.darkness = 0;
    }
else if (type === 'darkness') {
        finalValue = value * params.darkTrigger;
        target.darkness += Math.floor(finalValue);
        if (target.darkness < 0) target.darkness = 0;
    }

    // 彩蛋修正
    // 彩蛋修正 (使用配置值)
    if (target.favor < G_CONFIG.TRIGGER.DARK_FAVOR && target.personality.name === "市侩") target.darkness += 1;
    if (target.personality.name === "痴绝" && target.love > G_CONFIG.TRIGGER.DARK_LOVE) target.darkness += 1;}

// --- 匹配度计算 ---
export function calculateMatchScore(player, npc) {
    const cfg = G_CONFIG.MATCH;
    
    // 1. 基础分：好感 + 权重化的爱意
    let score = npc.favor; 
    score += npc.love * cfg.LOVE_WEIGHT; 
    
    // 2. 魅力吸引力
    score += (player.charm - npc.charm) * cfg.CHARM_GAP_WEIGHT; 
    
    // 3. 实力差距判定
    if (player.power > npc.power) {
        // 如果你更强：基础加成 + 性格额外崇拜
        let bonus = cfg.POWER_WIN_BASE;
        if (npc.personality.name === "骄阳") bonus += cfg.POWER_WIN_PRIDE_EXTRA;
        score += bonus;
    } else {
        // 如果你更弱：扣分
        score -= cfg.POWER_LOSS_PENALTY;
    }
    
    // 4. 年龄差距判定
    if (Math.abs(player.age - npc.age) > cfg.AGE_GAP_THRESHOLD) {
        score -= cfg.AGE_GAP_PENALTY;
    }

    // 上帝视角日志：帮你分析为什么求婚失败
    Logger.info("MATCH", `求婚对象:${npc.name} | 原始分:${score.toFixed(1)} | 门槛:${G_CONFIG.THRESHOLD.MATCH_SCORE_PROPOSE}`);

    return score;
}

// --- 境界突破检测 ---
export function checkRealmBreakthrough(person) {
    let currentRealm = getRealmName(person.power);
    if (currentRealm !== person.prevRealmName) {
        // ▼▼▼ 新增：写入履历 ▼▼▼
        History.record(person, 'breakthrough', `修为大进，成功突破至 [${currentRealm}] 境界。`);
        // 突破属于重要新闻，暂时归类为 gossip 但重要人物必显
        if (shouldLog('gossip', person)) {
            if (person.id === gameState.player.id) {
                addLog(`【突破】恭喜！你的境界突破至 <strong>${currentRealm}</strong>！`, "#d35400");
            } else {
                addLog(`【传闻】听说 ${linkName(person)} 突破到了 ${currentRealm}。`, "#7f8c8d");
            }
        }
        person.prevRealmName = currentRealm;
    }
}

// --- 属性成长与修炼系统 (v0.28 重构) ---
export function growAttributes(person, silent = false) {
    if (person.age < G_CONFIG.AGE.ADULT && !person.isImprisoned && !person.isDead) {
        let guardian = null;
        
        // 1. 优先跟随母亲 (只要母亲活着且没坐牢)
        if (person.motherId) {
            let mother = findPerson(person.motherId);
            // 特殊情况：如果母亲是玩家
            if (person.motherId === gameState.player.id) mother = gameState.player;
            
            if (mother && !mother.isDead && !mother.isImprisoned) {
                guardian = mother;
            }
        }

        // 2. 母亲不在，跟随父亲
        if (!guardian && person.fatherId) {
            let father = findPerson(person.fatherId);
            if (person.fatherId === gameState.player.id) father = gameState.player;
            
            if (father && !father.isDead && !father.isImprisoned) {
                guardian = father;
            }
        }

        // 3. 执行跟随
        if (guardian && person.location !== guardian.location) {
            person.location = guardian.location;
            // 只有当玩家在场时，才提示这条日志（避免刷屏）
            if (shouldLog('gossip', person)) {
               // 这一行可选，嫌吵可以注释掉
               // addLog(`【跟随】年幼的 ${person.name} 跟随 ${guardian.name} 来到了 ${getLocationName(person.location)}。`, "#7f8c8d");
            }
        }
    }
    if (person.spiritStones === undefined) person.spiritStones = 0; // <--- 新增：确保有灵石属性
    if (person.isImprisoned) return;
    // 修复尸体诈尸修炼的BUG：如果人死了，就停止成长
    if (person.isDead) return;
    // 区分玩家和NPC
    const isPlayer = (person.id === gameState.player.id);

// 【新增】成年礼：性格定型 (v0.36)
    // 只有当它是"懵懂"状态，且年龄达到 16 岁时触发
    if (person.age >= G_CONFIG.AGE.ADULT && person.personality.key === 'CHILD') {
        resolveChildPersonality(person);
    }   
    // 1. 属性成长：18岁定型 (v0.28.3 遗传优化版)
if (person.age < G_CONFIG.GROWTH.ADULT_AGE) {
        // 如果有潜力数据，按潜力生长；如果是旧存档/NPC没有潜力，按默认低速生长
        let intRate = (person.potential && person.potential.int) || G_CONFIG.GROWTH.DEFAULT_POTENTIAL;
        let charmRate = (person.potential && person.potential.charm) || G_CONFIG.GROWTH.DEFAULT_POTENTIAL;
        // 成长判定：概率增加
        // 比如 intRate 是 0.8，则 80% 几率 +1，20% 几率不涨
        // 如果 intRate > 1 (比如 1.5)，则必定 +1，且有 50% 几率再 +1
        
       if (Math.random() < intRate) person.int++;
    if (intRate > 1 && Math.random() < (intRate - 1)) person.int++; 

    // 魅力成长判定
    if (Math.random() < charmRate) person.charm++;
    if (charmRate > 1 && Math.random() < (charmRate - 1)) person.charm++;
}
    // [logic.js] growAttributes 函数内部替换块

    if (isPlayer) {
        // ================= 👑 玩家逻辑 =================
        let realmData = [...REALMS].reverse().find(r => person.power >= r.min) || REALMS[0];
       gameState.player.maxAP = realmData.ap || 3;
        // 1. 基础速度
        let baseSpeed = G_CONFIG.CULTIVATION.PLAYER_BASE_SPEED + (person.int * G_CONFIG.CULTIVATION.INT_WEIGHT);
        let efficiency = realmData.efficiency || 1.0;
        
        // 2. 特质修正 + ★ 真血修正
        let traitSpeedMult = 1.0;
        
        // --- ★ 核心修改：读取真血浓度 ---
        // 玩家拥有的是【天凤真血】，每 1% 浓度增加 1% 修炼速度
        let purity = person.bloodlinePurity || 0;
        traitSpeedMult += (purity * 0.01); 
        // ------------------------------

        person.traits.forEach(t => {
            if (t.name === "天道筑基") traitSpeedMult += 0.50;
            // 注意：删掉了旧的 if (t.name === "天凤血脉")，避免重复
            if (t.name === "纯阴之体" || t.name === "纯阳之体") traitSpeedMult += 0.20;
            if (t.name === "经脉堵塞") traitSpeedMult -= 0.50;
            if (t.name === "体弱多病") traitSpeedMult -= 0.20;
            if (t.name === "平庸") traitSpeedMult -= 0.10;
        });
        traitSpeedMult = Math.max(0.1, traitSpeedMult);

        // 3. 计算最终收益
        let ratio = gameState.player.ap / gameState.player.maxAP;
        // ▼▼▼ 新增：合欢蛊扣除精力逻辑 (R18) ▼▼▼
        if (person.buffs && person.buffs.xin_mo_yu) {
            // 心魔厌恶枯燥的打坐，扣除 30% 效率
            ratio -= 0.3; 
            if (ratio < 0) ratio = 0;
            
            if (ratio > 0 && !silent) {
                addLog(`【心魔作祟】心中的欲念让你无法静心，修炼效率大打折扣... (独修收益-30%)`, "#c0392b");
            }
        }
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
        let gain = Math.floor(baseSpeed * efficiency * traitSpeedMult * ratio);

        if (realmData.isBottleneck && person.power >= realmData.min) gain = 0; 
        person.power += gain;

        // 4. 日志反馈
        if (gain > 0 && !silent) {
            if (ratio >= G_CONFIG.CULTIVATION.AP_RATIO_HIGH) {
                addLog(`【闭关】你心无旁骛，潜心修炼。修为 +${gain}`, "#27ae60");
            } else if (ratio > G_CONFIG.CULTIVATION.AP_RATIO_MED) {
                addLog(`【日常】你在闲暇之余打坐周天。修为 +${gain}`, "#f1c40f");
            } else {
                addLog(`【懈怠】你俗务缠身，仅是匆匆吐纳。修为 +${gain}`, "#95a5a6");
            }
        } else if (realmData.isBottleneck && !silent) { // 瓶颈提示也顺便静音，避免闭关时一直刷“遇到瓶颈”
            addLog(`【瓶颈】你的修为已达 ${realmData.name} 巅峰，需寻找契机突破！`, "#d35400");
        }

        person.ap = person.maxAP;

    } else {
        // ================= 🧬 NPC 逻辑 =================
        let rank = getRealmRank(person.power);
        let efficiency = G_CONFIG.CULTIVATION.NPC_EFFICIENCY_MAP[rank] || 0.1;
        let baseSpeed = G_CONFIG.CULTIVATION.PLAYER_BASE_SPEED + (person.int * G_CONFIG.CULTIVATION.INT_WEIGHT);

        let traitSpeedMult = 1.0;
        
        // --- ★ 核心修改：读取灵犀度 ---
        // NPC 拥有的是【血脉灵犀】，同样享受加速（天赋异禀）
        let purity = person.bloodlinePurity || 0;
        traitSpeedMult += (purity * 0.01); 
        // ----------------------------

        person.traits.forEach(t => {
            if (t.name === "经脉堵塞") traitSpeedMult -= 0.50;
        });

        let gain = Math.floor(baseSpeed * efficiency * traitSpeedMult * G_CONFIG.CULTIVATION.NPC_AVERAGE_DILIGENCE);
        person.power += Math.max(G_CONFIG.CULTIVATION.MIN_GAIN, gain);
    }

// 通用数据维护
person.maxPower = Math.max(person.power, person.maxPower || 0);
checkLifeStatus(person);

    // 2. 【修改版】心魔劫判定
    // 心魔劫判定 (v0.28.2 修正：天凤血脉免疫)
    // 检查是否拥有天凤血脉
    const hasPhoenix = person.traits.some(t => t.name === "天凤血脉");

    if (person.power > G_CONFIG.CALAMITY.DEMON_MIN_POWER && !person.isDemonic && !hasPhoenix) {
    let risk = G_CONFIG.CALAMITY.DEMON_BASE_RISK + (person.power / G_CONFIG.CALAMITY.DEMON_RISK_DIVISOR);
    risk = Math.min(G_CONFIG.CALAMITY.DEMON_MAX_RISK, risk);

    if (Math.random() < risk) {
        person.isDemonic = true;
        let pName = person.personality.name;
        let logMsg = "";

        if (["清贵", "守心", "温润", "骄阳"].includes(pName)) {
            person.darkness += G_CONFIG.CALAMITY.DARKNESS_PUNISH;
            logMsg = `道心破碎，堕入杀道！虽然性格未变，但眼中已无慈悲，唯有杀戮！`;
        } else if (["市侩", "痴绝", "孤绝"].includes(pName)) {
            person.int = 0;
            person.darkness += 50;
            logMsg = `算计太深终误己！神智崩塌，智力归零，沦为疯癫痴儿！`;
        } else {
            let loss = Math.floor(person.power * G_CONFIG.CALAMITY.POWER_LOSS_PERCENT); 
            person.power -= loss;
            person.charm = 0; 
            logMsg = `真气逆行，走火入魔！修为暴跌 <strong>${loss}</strong> 点，形如枯槁！`;
        }

        if (shouldLog('gossip', person)) {
            addLog(`【心魔劫】${linkName(person)} 修炼时遭遇大劫！${logMsg}`, "#c0392b");
        }
        History.record(person, 'breakthrough', `修炼时急功近利，不幸走火入魔！(状态异常)`);
        }
    }
    // 天煞孤星判定
    if (person.traits.some(t => t.name === "天煞孤星")) {
    person.power += G_CONFIG.CALAMITY.SOLO_STAR_GAIN; 
    if (Math.random() < G_CONFIG.CALAMITY.SOLO_STAR_CHANCE) {
        let victims = gameState.npcs.filter(n => n.favor > 50 && n.id !== person.id);
        if (victims.length > 0) {
            let v = randomChoice(victims);
            v.power = Math.max(0, v.power - G_CONFIG.CALAMITY.SOLO_STAR_VICTIM_LOSS);
            if (shouldLog('battle', person, v)) {
                addLog(`【天煞孤星】受 ${linkName(person)} 命格影响，亲友 ${linkName(v)} 遭遇横祸！`, "#c0392b");
            }
            History.record(person, 'life', `命格凶煞，克伤了亲友 [${v.name}]。`);
        }
    }
}
checkRealmBreakthrough(person);
  }


// 3. 【修改】核心寿命检查函数 (通用版：支持玩家诅咒 + NPC随机寿命)
function checkLifeStatus(person) {
    const cfg = G_CONFIG.LIFE;
    // 1. 获取基础寿命上限
    let realmName = getRealmName(person.power);
    let baseMaxLife = (typeof LIFE_CAPS !== 'undefined' ? LIFE_CAPS[realmName] : null) || cfg.DEFAULT_BASE;

    // 2. 【新增】天命随机系数 (0.9 ~ 1.15)
    // 每个人出生时获得一个系数，一辈子不变。这样每个人的死期都不一样。
    if (!person.lifeFactor) {
        person.lifeFactor = cfg.FACTOR_MIN + (Math.random() * cfg.FACTOR_RANGE);
    }
    
    // 计算"自然寿元"
    let realMaxLife = Math.floor(baseMaxLife * person.lifeFactor);

    // 3. 特殊诅咒检查 (仅限玩家 + 天凤血脉)
    let isPlayer = (person.id === gameState.player.id);
    let hasPhoenix = person.traits.some(t => t.name === "天凤血脉");
    
    if (isPlayer && hasPhoenix) {
        // 【天凤血脉诅咒】浓度越高，寿命越短。
        // 计算公式：最终缩减倍率 = 基础倍率(2) + (浓度 * 0.02)
        // 效果：0%浓度时缩减2倍，50%浓度时缩减3倍，100%浓度时缩减4倍。
        let purity = person.bloodlinePurity || 0;
        let curseDiv = cfg.PHOENIX_CURSE_DIV + (purity * cfg.PURITY_CURSE_MULT); 
        realMaxLife = Math.floor(realMaxLife / curseDiv);
    }

    // 存入变量供 UI 显示
    person._maxLife = realMaxLife;
if (person.age >= realMaxLife - 5) {
         Logger.warn("LIFE", `${person.name} 寿元将尽！(年龄:${person.age} / 寿元:${realMaxLife})`);
    }
    // 4. 死亡判定
    if (person.age >= realMaxLife) {
        // 防止重复记录 (如果不加这个判断，死人每回合都会被记录一次“坐化”)
        if (!person.isDead) { 
            // === A. 如果是玩家死了 ===
            if (isPlayer) {
                // 检查有没有女儿可以夺舍
                let vessels = getValidVessels();
                
                if (vessels.length === 0) {
                    // 没有女儿 -> 坏结局 Game Over
                    person.isDead = true; // 彻底凉了
                    showModal("香火断绝", "你寿元耗尽，且膝下无女可承载神魂。<br>你的修仙家族至此终结。<br><br><strong>GAME OVER</strong>", "alert");
                    // 这里可以加一个 stopGame() 或者 reload 逻辑，暂时先弹窗
                } else {
                    // 有女儿 -> 强制触发夺舍 UI
                    // 注意：这里暂时不标记 isDead，或者标记 isDead 但 UI 提供“复活”入口
                    // 我们选择：标记 isDead，但在 UI 层拦截，强制显示夺舍弹窗
                    person.isDead = true; 
                    
                    // 呼叫 UI 层的夺舍选择器 (需要在 ui.js 实现)
                    if (window.handlePlayerDeath) {
                        window.handlePlayerDeath(vessels);
                    }
                }
            } 
            // === B. 如果是 NPC 死了 ===
            else {
                person.isDead = true;
                person.deathReason = "寿终正寝";
                History.record(person, 'life', `大限已至，坐化陨落。`);
                handleNPCDeath(person);
            }
        }
    }
    // 5. 临终预警 (只对玩家显示)
    else if (isPlayer && person.age >= realMaxLife - G_CONFIG.AGE.DEATH_WARN) {
        // 【新增判断】只有在每年的第1个月 (即总月数能被12整除) 才提示
        if (gameState.totalMonths % G_CONFIG.LIFE.WARN_INTERVAL_MONTHS === 0) {
            let yearsLeft = realMaxLife - person.age;
            addLog(`【天人五衰】你感到气血亏败，大限将至... (预感寿元仅剩 ${yearsLeft} 年左右)`, "#c0392b");
        Logger.warn("DEATH_CLOCK", `玩家大限预警：当前${person.age}岁，上限${realMaxLife}岁`);
        }
    }
}
// 【新增】处理 NPC 死亡的后事
function handleNPCDeath(npc) {
    // 1. 判断是否重要，决定发不发日志
    // (如果是配偶、子女、或者好感度极高的人，才发通知)
    let isImportant = (npc.id === gameState.spouseId) || 
                      gameState.children.some(c => c.id === npc.id) ||
                      (gameState.player.relationships && gameState.player.relationships[npc.id] > 50);

    if (isImportant) {
        addLog(`【生老病死】你的亲友 ${linkName(npc)} 寿元已尽，含笑而终，享年 ${npc.age} 岁。`, "#95a5a6");
    } 

    // 2. 处理身后事：如果是道侣死了，玩家变单身
    if (npc.id === gameState.spouseId) {
        gameState.spouseId = null;
        addLog(`【丧偶】你失去了道侣 ${npc.name}。修仙大道，终究是孤独的...`, "#34495e");
    }
}
// --- NPC 互动逻辑 (带设置过滤) ---
export function handleNPCInteractions() {
   const calCfg = G_CONFIG.CALAMITY;
    const socCfg = G_CONFIG.SOCIAL;
    // 0. 处理入魔者的自我救赎
    gameState.npcs.forEach(npc => {
        if (npc.isDemonic) {
            if (Math.random() < calCfg.RECOVERY_CHANCE) { // 10% 概率醒来
                npc.isDemonic = false; // 【核心】：移除标签即可
                npc.darkness = 0;      // 消除黑化
                
                let bonusPower = Math.floor(npc.power * calCfg.RECOVERY_POWER_RATE) + calCfg.RECOVERY_POWER_FLAT;
                npc.power += bonusPower;
                
                // 属性大补（不管之前掉的是什么，统统补回来甚至更强）
                npc.int += calCfg.RECOVERY_STAT_BONUS; 
                npc.charm += calCfg.RECOVERY_STAT_BONUS;

                if (shouldLog('gossip', npc)) {
                    addLog(`【渡劫成功】${linkName(npc)} 破除心魔，重获新生！神台清明，修为暴涨 <strong>${bonusPower}</strong>！`, "#f1c40f");
                }
            } else {
                // 没醒过来时的随机行为
               if (Math.random() < calCfg.DEMONIC_IDLE_LOG && shouldLog('gossip', npc)) {
                    let text = "神志不清，在大街上胡言乱语。";
                    if(npc.personality.name === "清贵") text = "双目赤红，提剑见人就砍。";
                    if(npc.personality.name === "市侩") text = "趴在泥坑里挖土，嘴里喊着‘金子’。";
                    addLog(`【心魔深重】${linkName(npc)} ${text}`, "#7f8c8d");
                }
            }
        }
    });
    
    // 1. 筛选活跃 NPC (活着的、没坐牢的、成年的、有修为的)
    let activeNPCs = gameState.npcs.filter(n => !n.isDead && !n.isImprisoned && n.age >= G_CONFIG.AGE.ADULT && n.power > 0);
    if (activeNPCs.length < socCfg.MIN_ACTIVE_NPCS) return; 

    // 2. 打乱顺序，模拟随机相遇
    activeNPCs.sort(() => Math.random() - 0.5);

    // 3. 动态设定事件数量：让修仙界热闹起来
    // 逻辑：每回合大约有 40% 的人会发生社交事件
    let maxEvents = Math.floor(activeNPCs.length * socCfg.ACTIVE_EVENT_RATE); 
    let eventCount = 0;

    for (let npc of activeNPCs) {
        if (eventCount >= maxEvents) break; // 达到本月上限
        if (Math.random() > socCfg.INDIVIDUAL_ACT_CHANCE) continue;  // 每个人本月有 30% 几率主动搞事
if (npc.spouseId) {
            let spouse = activeNPCs.find(n => n.id === npc.spouseId);
            // 如果配偶还活着且就在活跃列表里
            if (spouse) {
                let relation = npc.relationships[spouse.id] || 0;
                // 条件：好感低于 -20 或 信任/爱意(如果有的话)极低
                if (relation < socCfg.DIVORCE_THRESHOLD) {
                    // 解除关系
                    npc.spouseId = null;
                    spouse.spouseId = null;
                    
                    // 记录履历
                    History.record(npc, 'social', `与道侣 [${spouse.name}] 感情破裂，分道扬镳。`);
                    History.record(spouse, 'social', `与道侣 [${npc.name}] 缘分已尽，从此陌路。`);
                    
                    addLog(`【缘尽】${linkName(npc)} 与 ${linkName(spouse)} 感情破裂，解除了道侣关系。`, "gray");
                    eventCount++;
                    continue; // 离婚了就别造人了
                }
            }
        Logger.info("SOCIAL", `本月社交事件产出: ${eventCount}/${maxEvents}`);
        }
        

        // --- A. 优先处理：夫妻生活 (繁衍核心) ---
        if (npc.spouseId && !npc.pregnancyProgress) { 
            let spouse = activeNPCs.find(n => n.id === npc.spouseId);
            // 确保配偶没怀孕(如果是女)、关系尚可，且【两人必须在同一个地方】
            if (spouse && !spouse.pregnancyProgress && (npc.relationships[spouse.id] || 0) > 20 && npc.location === spouse.location) {
                // 15% 几率造人
                if (Math.random() < G_CONFIG.CHANCE.PREGNANCY) {
                    
                    // 【修改】确定谁怀孕 (只允许异性夫妻，且强制女方怀孕)
                    let mother = null;
                    let father = null;

                    // 只有当“我是女，他是男”或者“我是男，她是女”时才生效
                    if (npc.gender === '女' && spouse.gender === '男') {
                        mother = npc; father = spouse;
                    } else if (npc.gender === '男' && spouse.gender === '女') {
                        mother = spouse; father = npc;
                    }

                    // 如果能确定出母亲（说明是异性夫妻），且母亲没怀孕
                    if (mother && !mother.pregnancyProgress) {
                        mother.pregnancyProgress = 1;
                        mother.birthTarget = randomInt(8, 10); 
                        mother.childParentId = father.id; // 孩子是对方的
                        
                        History.record(mother, 'life', `与道侣 [${father.name}] 琴瑟和鸣，珠胎暗结。`);
                        History.record(father, 'life', `爱妻 [${mother.name}] 已怀有身孕。`);
                        eventCount++;
                        continue; 
                    }
                }
            }
        }

        // --- B. 寻找随机互动对象 ---
       // --- B. 寻找随机互动对象 ---
        // 修改：必须寻找同一个地点的目标
        let potentialTargets = activeNPCs.filter(t => t.id !== npc.id && t.location === npc.location);
        
        // 如果当前场景没别人，就跳过这个NPC的互动
        if (potentialTargets.length === 0) continue; 

        let target = randomChoice(potentialTargets);
        
        // 初始化关系数据
        if (!npc.relationships[target.id]) npc.relationships[target.id] = 0;
        if (!target.relationships[npc.id]) target.relationships[npc.id] = 0;

        let roll = Math.random();

        // 事件 1: 仇杀 (关系极差)
        if (npc.relationships[target.id] < -30) {
            npc.relationships[target.id] -= 10;
            target.relationships[npc.id] -= 10;
            
            // 记录履历 (始终记录)
            History.record(npc, 'battle', `与仇敌 [${target.name}] 狭路相逢，大打出手。`);
            History.record(target, 'battle', `遭遇 [${npc.name}] 挑衅，双方发生激战。`);
            
            // 尝试记录日志 (受过滤器控制)
            if (shouldLog('battle', npc, target)) {
                addLog(Text.Logs.npcFight(npc, target), "#7f8c8d");
            }
            eventCount++;
        }
        
        // 事件 2: 闲聊/论道 (普通社交)
        else if (roll < 0.7) {
            npc.relationships[target.id] += 5;
            target.relationships[npc.id] += 5;
            
            // 关系好的话，记录一下
            if (npc.relationships[target.id] > 30) {
                History.record(npc, 'social', `与 [${target.name}] 在茶楼相谈甚欢。`);
                
                // 只有特别熟的才会上八卦
                if (npc.relationships[target.id] > 60 && shouldLog('gossip', npc, target)) {
                    addLog(Text.Logs.npcChat(npc, target), "#8e44ad");
                }
                eventCount++;
            }
        }
        
        // 事件 3: 表白/求婚 (高好感 + 单身)
        else if (!npc.isSpouse && !target.isSpouse && !npc.spouseId && !target.spouseId && npc.gender !== target.gender) {
             let liking = npc.relationships[target.id];
             // 门槛：好感 > 60
             if (liking > 60) {
                 // 对方也得看得上你 (慕强或相看两不厌)
                 let targetLiking = target.relationships[npc.id] || 0;
                 let isWorthy = npc.power >= (target.power * 0.7); // 只要不是废柴太多就行
                 
                 if (targetLiking > 50 && isWorthy) {
                     // === 牵手成功 ===
                     npc.relationships[target.id] += 20; 
                     target.relationships[npc.id] += 20;
                     npc.spouseId = target.id;
                     target.spouseId = npc.id;
                     // 标记为已婚（注意：isSpouse 字段在以前只用于标记“玩家的配偶”，但在NPC社交里我们只用 spouseId 判断即可，isSpouse 留给玩家专用）

                     History.record(npc, 'love', `向 [${target.name}] 表白成功，二人正式结为道侣。`);
                     History.record(target, 'love', `接受了 [${npc.name}] 的心意，与其结为道侣。`);

                     if (shouldLog('gossip', npc, target)) {
                         addLog(`【喜讯】${linkName(npc)} 与 ${linkName(target)} 情投意合，结为道侣！`, "#e91e63");
                     }
                 } else {
                     // === 表白失败 ===
                     npc.relationships[target.id] -= 5; 
                     // 只有被拒这种尴尬事才容易传八卦
                     if (shouldLog('gossip', npc, target)) {
                        addLog(`【八卦】${linkName(npc)} 苦恋 ${linkName(target)} 无果，黯然神伤。`, "#7f8c8d");
                     }
                 }
                 eventCount++;
             }
        }
    }
}

// [logic.js] 升级版 birthBaby (支持多胞胎 + 异步弹窗)
export async function birthBaby(parent) { 
    // 1. 防止重复触发的锁
    if (parent.isBirthing) return; 
    parent.isBirthing = true;
    try {
    // 1. 确定另一半
    // 1. 确定另一半
    let otherId = parent.childParentId || gameState.player.id;
    let otherParent = findPerson(otherId);
    
    // 【修复逻辑】防止NPC配偶死亡后，玩家被迫喜当爹
    if (!otherParent) {
        // 只有当原本记录的 ID 就是玩家时，才认定是玩家
        if (otherId === gameState.player.id) {
            otherParent = gameState.player;
        } else {
            // 否则，创建一个临时的“已故”对象作为占位，避免逻辑报错
            // 注意：这里需要引入 createPerson，确保文件头部 import 了它
            otherParent = createPerson(false); 
            otherParent.name = "已故生父"; 
            otherParent.id = otherId; 
            // 自动设定为异性（为了保证父母性别不同）
            otherParent.gender = (parent.gender === '女') ? '男' : '女';
        }
    }

    // 2. 确定生物学父母
    let father, mother;
    if (parent.gender === '男') {
        father = parent;      
        mother = otherParent; 
    } else {
        mother = parent;      
        father = otherParent;
    }

    // 3. --- 多胞胎判定逻辑 ---
    let numChildren = 1;
    let isMultiPill = false;

    // A. 检查 buff
    if (gameState.player.buffs && gameState.player.buffs.next_multi) {
        if (father.id === gameState.player.id || mother.id === gameState.player.id) {
            isMultiPill = true;
            numChildren = Math.random() < 0.7 ? 2 : 3;
            delete gameState.player.buffs.next_multi;
            addLog("【药效触发】多子丸神力显现，此胎必为多胞胎！", "#e91e63");
        }
    }

    // B. 自然概率
    if (!isMultiPill) {
        if (Math.random() < 0.02) {
            numChildren = Math.random() < 0.7 ? 2 : 3;
            addLog("【祥瑞】天降祥瑞，此胎竟是多胞胎！", "#f1c40f");
        }
    }

    // 4. --- 循环生娃 ---
    for (let i = 0; i < numChildren; i++) {
        let suffix = "";
        if (numChildren > 1) suffix = ` (第${i+1}子)`;

        // ★★★ 变化2：加了 await ★★★
        // 这里的 await 保证了前一个孩子取完名，才轮到下一个
        await processSingleBirth(parent, father, mother, suffix);
    }
} catch (error) {
        console.error("【严重错误】生孩子逻辑崩溃:", error);
        // 如果有报错，弹窗告诉玩家，防止一脸懵逼
        if (window.showModal) window.showModal("系统错误", `生产过程中发生异常，但已强制结束分娩。<br>错误信息: ${error.message}`, "alert");
    } finally {
        // 5. 生完后的清理
    parent.pregnancyProgress = 0;
    parent.birthTarget = 0;
    parent.childParentId = null;
    parent.isPregnant = false;
    parent.isBirthing = false;
    if (gameState.player.buffs && gameState.player.buffs.next_sure) {
        delete gameState.player.buffs.next_sure;
    }
    if(window.updateUI) window.updateUI();
}
}

// --- 内部辅助函数：处理单个孩子的出生逻辑 ---
// [logic.js] 内部辅助函数 (异步UI版)
async function processSingleBirth(parent, father, mother, suffix) { // <--- 变化1：加了 async
    // 生成孩子对象
    let tempChild = createPerson(false, father, mother);
    tempChild.location = parent.location; 

    // ============================================
    //  分支 A: 玩家参与的生子
    // ============================================
    if (father.id === gameState.player.id || mother.id === gameState.player.id) {
        
        let interactNPC = (father.id === gameState.player.id) ? mother : father;
        let isIllegitimate = (gameState.spouseId !== interactNPC.id);

        // ----------------------------------------------------------------
        // 第一步：纸包不住火 (逻辑不变)
        // ----------------------------------------------------------------
        if (interactNPC.spouseId && interactNPC.spouseId !== gameState.player.id) {
            let cuckoldId = interactNPC.spouseId;
            let cuckold = findPerson(cuckoldId);
            
            if (cuckold) {
                addLog(`【后院起火】${linkName(interactNPC)} 产下私生子之事，被其道侣 ${linkName(cuckold)} 发现了！`, "#c0392b");
                let cType = cuckold.personality.name;
                
                if (["清贵", "孤绝", "骄阳", "痴绝"].includes(cType)) {
                    interactNPC.spouseId = null;
                    interactNPC.isSpouse = false; 
                    cuckold.spouseId = null;
                    changeEmotion(cuckold, 'favor', -100);
                    changeEmotion(cuckold, 'darkness', 50);
                    cuckold.isNemesis = true;
                    addLog(`【决裂】${linkName(cuckold)} 性烈如火，无法忍受背叛，当场写下休书，与 ${linkName(interactNPC)} 恩断义绝！`, "#c0392b");
                    History.record(cuckold, 'social', `发现道侣 [${interactNPC.name}] 与 [${gameState.player.name}] 有染，愤而离婚。`);
                    History.record(interactNPC, 'social', `因私情败露，被道侣 [${cuckold.name}] 休弃。`);
                } else {
                    changeEmotion(cuckold, 'favor', -50);
                    changeEmotion(cuckold, 'love', -50);
                    addLog(`【隐忍】${linkName(cuckold)} 虽未当场发作，但看着 ${linkName(interactNPC)} 的眼神已无半分温情。`, "#7f8c8d");
                    History.record(cuckold, 'social', `得知道侣 [${interactNPC.name}] 与 [${gameState.player.name}] 有染，虽未离婚，但心生芥蒂。`);
                }
                
                if (!cuckold.isNemesis) {
                     if (!cuckold.relationships) cuckold.relationships = {};
                     cuckold.relationships[gameState.player.id] = -60; 
                     changeEmotion(cuckold, 'favor', -60);
                }
            }
        }

        // ----------------------------------------------------------------
        // 第二步：玩家的命运抉择 (替换 UI)
        // ----------------------------------------------------------------
        if (isIllegitimate) {
            playSound('popup');
            // ★★★ 变化2：使用 showModal 替换 confirm ★★★
            // 注意：因为 showModal 支持 HTML，我把 \n 换成了 <br>
            let confirmMsg = `【私生子抉择${suffix}】<br><br><strong>${interactNPC.name}</strong> 为你诞下一子 <strong>[${tempChild.name}]</strong>。<br>但你们并非道侣，此子身份尴尬。<br><br>你要认下这个孩子吗？<br><br>• <strong>认祖归宗</strong>：改姓入族谱，但可能激怒你的配偶<br>• <strong>始乱终弃</strong>：孩子随对方姓，对方将视你为仇敌`;
            
            let accept = await showModal('身世之谜', confirmMsg, 'confirm');

            if (accept) {
                // === 选项 A: 认祖归宗 (修改版：增加赐名弹窗) ===
                
                // 1. 预处理一个建议名字 (尝试把外姓改成云姓，作为默认值)
                // 假设原名是 "李狗蛋"，自动建议为 "云狗蛋"
                let defaultName = tempChild.name;
                // 如果原名不姓云，试着简单粗暴地加个云字 (用户可以在弹窗里自己修)
                if (!defaultName.startsWith("云")) {
                    defaultName = "云" + defaultName; 
                }

                // 2. ★★★ 新增：改名弹窗 ★★★
                let newNameInput = await showModal(
                    '认祖归宗', 
                    `你决定认下这个孩子，将其录入族谱。<br>孩子原名：<strong>${tempChild.name}</strong><br><br>请为孩子赐名 (族姓：云)：`, 
                    'prompt', 
                    defaultName // 这里的默认值会自动填在输入框里
                );

                // 3. 处理输入
                if (newNameInput && newNameInput.trim() !== "") {
                    let finalName = newNameInput.trim();
                    // 强制规则：既然认祖归宗了，就得姓云 (防止玩家输错，自动补全)
                    if (!finalName.startsWith("云")) finalName = "云" + finalName;
                    tempChild.name = finalName;
                } else {
                    // 如果玩家留空直接点确定，就用默认建议的名字
                    tempChild.name = defaultName;
                }

                // 4. 洗白并入库
                tempChild.isIllegitimate = false; 
                gameState.children.push(tempChild);
                
                addLog(`你力排众议，认下了私生子 ${linkName(tempChild)}，并为其改名入族。`, "#e74c3c");
                
                History.record(gameState.player, 'life', `公开承认了与 [${interactNPC.name}] 的私生子，并赐名 [${tempChild.name}]。`);
                History.record(interactNPC, 'life', `孩子 [${tempChild.name}] 被生父/母 [${gameState.player.name}] 带走抚养。`);

                // ------------------------------------------------------------
                // 第三步：引火烧身 (保持原样，不用动)
                // ------------------------------------------------------------
                if (gameState.spouseId) {
                    let mySpouse = findPerson(gameState.spouseId);
                    if (mySpouse && mySpouse.id !== interactNPC.id) {
                        let sType = mySpouse.personality.name;
                        let sName = linkName(mySpouse);
                        addLog(`【后院失火】你的道侣 ${sName} 看到了你带回来的私生子，心痛难耐。`, "#c0392b");
if (mySpouse && typeof History !== 'undefined') {
            // 构造一条扎心的履历
            const painLog = `得知道侣 [${gameState.player.name}] 与他人生下私生子 [${tempChild.name}]，心痛难忍。虽感万般羞辱，却因情深难断，终是叹息一声，默许了这荒唐之事。`;
            
            // 记录到配偶的履历中
            History.record(mySpouse, 'life', painLog); 
        }
                        // ... (后面的修罗场逻辑完全不用动，直接保留即可) ...
                        if (["清贵", "痴绝", "骄阳"].includes(sType)) {
                             // ...
                             if (Math.random() < 0.5) {
                                 // ... 离婚逻辑 ...
                                 gameState.spouseId = null;
                                 mySpouse.isSpouse = false;
                                 mySpouse.spouseId = null;
                                 mySpouse.isNemesis = true;
                                 changeEmotion(mySpouse, 'favor', -100);
                                 changeEmotion(mySpouse, 'love', -100);
                                 changeEmotion(mySpouse, 'darkness', 50);
                                 addLog(`【被休】${sName} 无法忍受此等羞辱，当场摔碎信物，与你恩断义绝！`, "#c0392b");
                                 History.record(mySpouse, 'social', `因无法忍受 [${gameState.player.name}] 带回私生子，愤而休夫/妻。`);
                             } else {
                                 changeEmotion(mySpouse, 'favor', -50);
                                 changeEmotion(mySpouse, 'darkness', 30);
                                 addLog(`${sName} 面色铁青地忍了下来，但看着那孩子的眼神充满了寒意。`, "#c0392b");
                             }
                        } else {
                            changeEmotion(mySpouse, 'favor', -30);
                            changeEmotion(mySpouse, 'love', -10);
                            addLog(`${sName} 叹了口气，虽然心中膈应，但还是默许了这个孩子的存在。`, "#95a5a6");
                        }
                    }
                }
            } else {
                // === 选项 B: 始乱终弃 ===
                tempChild.isIllegitimate = true;
                let surname = (typeof getSurname === 'function') ? getSurname(interactNPC) : "无";
                tempChild.name = generateName(tempChild.gender, surname, true);
                gameState.npcs.push(tempChild);

                changeEmotion(interactNPC, 'favor', -80);
                changeEmotion(interactNPC, 'love', -50); 
                changeEmotion(interactNPC, 'darkness', 50);
                interactNPC.isNemesis = true;

                addLog(`你冷酷地拒绝了。 ${linkName(interactNPC)} 抱着孩子 ${linkName(tempChild)} 在风中瑟瑟发抖，眼中满是怨毒。`, "#7f8c8d");
                History.record(gameState.player, 'life', `拒不承认与 [${interactNPC.name}] 的私生子，任其流落民间。`);
                History.record(interactNPC, 'life', `遭到 [${gameState.player.name}] 始乱终弃，独自抚养私生子 [${tempChild.name}]，发誓报复。`);
            }

        } else {
            // --- 正常婚生子逻辑 ---
            let titleName = interactNPC.gender === '男' ? '夫君' : '道侣'; 
            playSound('popup');
            
            // ★★★ 变化3：使用 showModal 替换 prompt ★★★
            // 参数：标题, 内容, 类型('prompt'), 默认值
            let inputName = await showModal(
                `麟儿降世${suffix}`, 
                `${titleName} <strong>${interactNPC.name}</strong> 为你诞下${tempChild.gender}婴。<br>默认名：${tempChild.name}<br>请赐名：`, 
                'prompt', 
                tempChild.name
            );

            if (inputName && inputName.trim() !== "") {
                let finalName = inputName.trim();
                if (!finalName.startsWith("云")) finalName = "云" + finalName;
                tempChild.name = finalName;
            }

            gameState.children.push(tempChild);
            let traitLog = tempChild.traits.some(t => t.name === "天凤血脉") ? "继承了【天凤血脉】！" : "";
            addLog(`【喜报】<strong>${linkName(interactNPC)}</strong> 产下 ${linkName(tempChild)}。${traitLog}`, "#27ae60");
            History.record(interactNPC, 'life', `与 [${gameState.player.name}] 诞下孩子 [${tempChild.name}]。`);
            History.record(tempChild, 'life', `降生于世，父 [${father.name}]，母 [${mother.name}]。`);
        }
    }
    // 分支 B: NPC 之间生子 (不用改)
    else {
        tempChild.fatherId = father.id;
        tempChild.motherId = mother.id;
        gameState.npcs.push(tempChild);
        History.record(father, 'life', `与 [${mother.name}] 诞下一子 [${tempChild.name}]。`);
        History.record(mother, 'life', `与 [${father.name}] 诞下一子 [${tempChild.name}]。`);
    }
}
// logic.js - v0.26 仇怨化解版

// ... 之前的代码保持不变 ...

/**
 * 寻找适合的说客
 * 条件：与玩家好感度 > 80，且与目标 NPC 关系 > 50
 */
export function findMediator(targetNpc) {
    return gameState.npcs.find(n => 
        n.id !== targetNpc.id && 
        n.favor > 80 && 
        (n.relationships[targetNpc.id] || 0) > 50
    );
}

/**
 * 劝说逻辑处理
 * @param {string} method - 'normal' (普通), 'sacrifice' (苦肉计), 'mediator' (说客)
 */
// [logic.js] 劝说/调解 完整修复版
export function handlePersuasion(target, method, mediator = null) {
    let success = false;
    let log = "";
    const p = gameState.player;

    // ==========================================
    // 1. 判定阶段 (计算成功率)
    // ==========================================
    if (method === 'normal') {
        // 普通劝说：看魅力和当前好感
        let chance = (gameState.player.charm * 0.2 + target.favor * 0.1) / 100;
        if (Math.random() < chance) success = true;
    } 
    else if (method === 'sacrifice') {
        // 苦肉计：自废修为
        let dmg = randomInt(50, 100);
        gameState.player.power = Math.max(0, gameState.player.power - dmg);
        
        let chance = 0.6; 
        if (target.personality.dao === 'humanist') chance = 0.9; // 入世者心软
        
        // 这里的 isRelated 是判定是否有血缘关系
        if (typeof isRelated === 'function' && isRelated(p, target)) {
            chance += 0.2; // 虎毒不食子，血亲加成
            log = `你当众喷出一口精血，不惜自废 <strong>${dmg}</strong> 点修为！身为血亲的 [${target.name}] 见状，眼中满是动摇。`;
        } else {
            log = `你当众自废 <strong>${dmg}</strong> 点修为以谢罪！`;
        }
        
        if (Math.random() < chance) success = true;
        
        // 无论成功失败，自残的事实都记入履历
        History.record(gameState.player, 'battle', `为求 [${target.name}] 原谅，不惜自废部分修为。`);
    }
    else if (method === 'mediator' && mediator) {
        // 说客劝说
        let chance = (mediator.int * 0.5 + mediator.relationships[target.id] * 0.3) / 100;
        if (Math.random() < chance) {
            success = true;
        } else {
            // 失败惩罚：连说客一并恨上 (30%几率)
            if (Math.random() < 0.3) {
                mediator.relationships[target.id] = (mediator.relationships[target.id] || 0) - 50;
                target.relationships[mediator.id] = (target.relationships[mediator.id] || 0) - 50;
                addLog(`【连累】${linkName(target)} 怒斥 ${linkName(mediator)} 多管闲事，两人当场反目！`, "#c0392b");
                
                History.record(mediator, 'social', `好心为 [${gameState.player.name}] 做说客，却被 [${target.name}] 痛骂，二人反目。`);
                History.record(target, 'social', `怒斥多管闲事的说客 [${mediator.name}]，与其断绝往来。`);
            }
        }
    }

    // ==========================================
    // 2. 最终结算阶段
    // ==========================================
    if (success) {
        target.isNemesis = false; // 移除仇恨标记

        // 🟢【核心修复】好感度回正逻辑
        // 如果原好感是负的（比如-80），直接拉回正数（比如+15），代表"翻篇了"
        // 如果原好感本身就是正的，则在原基础上增加
        if (target.favor < 0) {
            target.favor = 15; 
        } else {
            changeEmotion(target, 'favor', 50);
        }
        changeEmotion(target, 'love', 10);
        
        // 如果黑化值过高，适当净化一下，防止立刻又变仇敌
        if (target.darkness > 50) target.darkness = Math.floor(target.darkness * 0.8);

        // 输出成功日志
        let successLog = `【化解】在 ${log || '一番交谈'} 后，${linkName(target)} 终于是长叹一声，放下了对你的仇怨。`;
        addLog(successLog, "#27ae60");

        // --- A. 常规履历记录 ---
        if (method === 'sacrifice') {
            History.record(target, 'social', `被 [${p.name}] 自废修为的诚意打动，放下了仇恨。`);
        } else if (method === 'mediator' && mediator) {
            History.record(target, 'social', `看在 [${mediator.name}] 的面子上，勉强原谅了 [${p.name}]。`);
        } else {
            History.record(target, 'social', `在 [${p.name}] 的诚恳劝说下，释怀往事。`);
        }

        // --- B. 【核心：全血亲背德归顺逻辑】 ---
        // 只有开启了 R18 且是血亲才检查
        if (gameState.settings.enableR18 && typeof isRelated === 'function' && isRelated(p, target)) {
            // 计算平均开发度
            let bodyDevLevel = 0;
            let maxPartDev = 0;
            if (target.bodyStats) {
                let vals = Object.values(target.bodyStats);
                // 防止除以0
                bodyDevLevel = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
                maxPartDev = Math.max(...vals);
            }

           // 2. 判定条件 (大幅降低门槛)
            // 条件A: 平均开发度 > 30 (全身都有感觉了，不用到60那么高)
            // 条件B: 单部位开发度 > 80 (虽然整体还行，但某个部位已经被玩坏了，产生了弱点)
            let isDepraved = (bodyDevLevel > 30) || (maxPartDev > 80);

            if (isDepraved) {
                target.isStockholm = true; // 激活扭曲依恋
                
                // 覆盖/追加背德日志
                let reason = (maxPartDev > 80) ? "身体的极乐弱点" : "彻底沦陷的肉体";
                let tabooLog = `<br><span style="color:#e91e63; font-weight:bold;">【背德归顺】</span> 因${reason}，[${target.name}] 的心理防线彻底崩塌。面对血脉至亲的侵犯，他从极度痛苦转为了变态的依赖。`;
                addLog(tabooLog, "#e91e63");

                if (typeof History !== 'undefined') {
                    History.record(target, 'life', `血脉禁忌断裂。在 [${p.name}] 的调教下，甘愿沦为血亲的禁脔。`);
                    History.record(p, 'life', `成功驯服血亲 [${target.name}]，使其在羞耻与快感中彻底沉沦。`);
                }
            }
        }

    } else {
        // === 失败分支 ===
        changeEmotion(target, 'favor', -20);
        changeEmotion(target, 'darkness', 10);
        addLog(`【失败】${linkName(target)} 对你的劝说嗤之以鼻：“血海深仇，岂是三言两语能了？”`, "#c0392b");

        History.record(target, 'social', `面对 [${gameState.player.name}] 的求和无动于衷，心中仇恨更甚。`);
        History.record(gameState.player, 'social', `试图化解与 [${target.name}] 的仇恨，但被对方冷硬回绝。`);
    }

    return success;
}
// --- 夺舍转生系统 (v0.28 新增) ---

// [logic.js] 夺舍转生 v2.0 (母系家族版)
// [logic.js] 修复版 seizeBody (增加全服标签清洗)
export function seizeBody(targetId) {
    const vessels = getValidVessels();
    const targetBody = vessels.find(c => c.id === targetId);

    if (!targetBody) {
        console.error("夺舍目标无效！");
        return false;
    }

    const oldPlayer = gameState.player;
    const generationCount = gameState.generation || 1; // 假设你在 gameState 存了代数
// 1. 为旧身体留下“谢幕”记录
    History.record(oldPlayer, 'life', 
        `【家族史诗】一代家主之魂于此肉身消散，神魂跨越轮回，降临于子嗣 [${targetBody.name}] 之躯。`);

    // 2. 为新身体留下“觉醒”记录
    History.record(targetBody, 'life', 
        `【借尸还魂】意识深处涌现出祖辈的记忆，神魂彻底融合。自此，我即是 [${oldPlayer.name}]，亦是家族的新火。`);

    // 3. 记录到全局大事件 (如果有全局历史的话)
    addLog(`【轮回】第 ${generationCount} 代传人 [${oldPlayer.name}] 成功夺舍，开启第 ${generationCount + 1} 代修行。`, "#9b59b6");
   // 增加家族代数
    gameState.generation = generationCount + 1;
    // 1. 旧身体处理
    oldPlayer.isDead = true;
    oldPlayer.deathReason = "寿终正寝 (神魂离体)";
    
    // 【关键修复】确保旧身体一定被塞进 NPC 列表，否则族谱找不到她
    // 还要确保她不带特殊标签
    oldPlayer.isSpouse = false; 
    oldPlayer.isNemesis = false;
    
    // 防止重复添加
    if (!gameState.npcs.find(n => n.id === oldPlayer.id)) {
        gameState.npcs.push(oldPlayer);
    }
    
    // 2. 继承资产
    if (oldPlayer.items && oldPlayer.items.length > 0) {
        targetBody.items = targetBody.items.concat(oldPlayer.items);
    }
    if (oldPlayer.spiritStones > 0) {
        targetBody.spiritStones = (targetBody.spiritStones || 0) + oldPlayer.spiritStones;
    }

    // 3. 核心：身份切换
    gameState.player = targetBody;
targetBody.isMainSoul = true; 
targetBody.generation = gameState.generation; // 记录她是第几代
// 记录前世的名字，方便在族谱里显示“XX 转生为 XX”
targetBody.prevLifeName = oldPlayer.name;
    // ============================================
    // 【新增】Step 3.1: 全服洗点 (清除上一代的恩怨标签)
    // ============================================
    gameState.npcs.forEach(npc => {
        // 撕掉配偶标签 (前夫哥变成路人/父亲)
        npc.isSpouse = false; 
        npc.spouseId = null; // 暂时让他单身，等族谱逻辑去连线亡妻

        // 撕掉仇人/爱慕标签 (这些是针对旧主角的)
        npc.isNemesis = false;
        npc.isStockholm = false;

        // 注意：relationships 数据不用删，因为那是 NPC 对 "旧ID" 的记忆
        // 留着它，我们才能触发 "灵魂回响"
        
        // 如果这个 NPC 是前夫，保留 spouseId 指向旧主角？
        // 不，按游戏逻辑他现在是丧偶。spouseId = null 是对的。
    });
    
    // 4. 新身体数据清洗
    gameState.children = gameState.children.filter(c => c.id !== targetBody.id);
    gameState.spouseId = targetBody.spouseId || null;
    targetBody.isSpouse = false; // 自己不能是自己的配偶
    
    // 5. 日志与刷新
    addLog(`【轮回】旧躯已朽，神魂不灭。你成功夺舍了女儿 <strong>${targetBody.name}</strong>！`, "#9b59b6");
    
    if (window.updateUI) window.updateUI();

   // 如果这一代夺舍后，浓度达到了 100%
    if (gameState.player.bloodlinePurity >= 100) {
        addLog("【神迹】血脉本源彻底觉醒，天凤重临世间！", "#f1c40f");
        // 稍作延迟，给玩家看一眼属性的机会
        setTimeout(() => {
            if (window.triggerAscensionEnding) window.triggerAscensionEnding();
        }, 3000);
    }

    return true;
}
// [logic.js] 获取合法的夺舍容器 (仅限活着的亲生女儿)
export function getValidVessels() {
    // 1. 必须是子嗣列表里的
    // 2. 必须活着 (!isDead)
    // 3. 必须是女性 (母系氏族铁律)
    // 4. 必须未被囚禁 (可选，为了防止BUG暂时加上)
    return gameState.children.filter(c => 
        !c.isDead && 
        c.gender === '女' && 
        !c.isImprisoned
    );
}
// --- 境界突破系统 (v0.28.16 心性/心魔修正版) ---
export function handleBreakthrough(person) {
    // 1. 查找当前与下一境界
    let currentRealmIdx = -1;
    for (let i = REALMS.length - 1; i >= 0; i--) {
        if (person.power >= REALMS[i].min) {
            currentRealmIdx = i;
            break;
        }
    }
    if (currentRealmIdx === -1 || currentRealmIdx >= REALMS.length - 1) return { success: false, msg: "已至巅峰！" };

    let currentRealm = REALMS[currentRealmIdx];
    let nextRealm = REALMS[currentRealmIdx + 1];

    if (!currentRealm.isBottleneck) return { success: false, msg: "非瓶颈期。" };

    // 2. 准备基础概率与身份判定
    const isPlayer = (person.id === gameState.player.id);
    // ▼▼▼ 修改点：使用配置的基础概率 (70) ▼▼▼
    let baseChance = G_CONFIG.BREAKTHROUGH.BASE_CHANCE; 
    let finalChance = baseChance;

    // --- 【核心逻辑修改】：心性决定突破 ---
    if (isPlayer) {
        // ▼▼▼ 修改点：使用配置的智力加成 (0.1) ▼▼▼
        finalChance = baseChance + (person.int * G_CONFIG.BREAKTHROUGH.INT_BONUS); 
    } else {
        // ▼▼▼ 修改点：使用配置的黑化惩罚 (0.5) ▼▼▼
        let heartDemonPenalty = (person.darkness || 0) * G_CONFIG.BREAKTHROUGH.DARK_PENALTY; 
        finalChance = baseChance - heartDemonPenalty;
    }

    // 3. 特殊阶段判定逻辑
    let eventMsg = ""; 
    let isDeathRisk = false; 

    // === A. 筑基阶段 (炼气圆满 -> 筑基) ===
    if (currentRealm.name === "炼气圆满") {
        // ▼▼▼ 修改点：使用配置的智力门槛(60) 和 随机概率(0.1) ▼▼▼
        if (person.int >= G_CONFIG.THRESHOLD.INT_PERFECT || Math.random() < G_CONFIG.BREAKTHROUGH.CHANCE_PERFECT) {
            eventMsg = "perfect_foundation";
        }
    }
    
    // === B. 结丹阶段 (筑基圆满 -> 金丹) ===
    else if (currentRealm.name === "筑基圆满") {
        eventMsg = "golden_core_grade";
    }

    // === C. 化神雷劫 (元婴圆满 -> 化神) ===
    else if (currentRealm.tribulation) {
        isDeathRisk = true;
        // ▼▼▼ 修改点：使用配置的危险关卡基础概率 (30) ▼▼▼
        let tribulationBase = G_CONFIG.BREAKTHROUGH.DANGER_BASE;
        
        if (isPlayer) {
            finalChance = tribulationBase + (person.int * G_CONFIG.BREAKTHROUGH.INT_BONUS);
        } else {
            finalChance = tribulationBase - (person.darkness * G_CONFIG.BREAKTHROUGH.DARK_PENALTY);
        }

        // ▼▼▼ 修改点：使用配置的一品金丹加成 (20) ▼▼▼
        if (person.traits.some(t => t.name === "一品金丹")) finalChance += G_CONFIG.BREAKTHROUGH.TRAIT_BONUS_GOLDEN;
    }

    // ▼▼▼ 修改点：使用配置的极值范围 (5 ~ 95) ▼▼▼
    finalChance = Math.min(G_CONFIG.BREAKTHROUGH.MAX_CHANCE, Math.max(G_CONFIG.BREAKTHROUGH.MIN_CHANCE, finalChance));

    // 4. 执行概率判定
    let roll = Math.random() * 100;
    let isSuccess = roll < finalChance;

    // --- 结果处理 ---
    if (isSuccess) {
        // ▼▼▼ 修改点：使用配置的奖励数值 (500, 5, 2) ▼▼▼
        person.power = nextRealm.min + G_CONFIG.REWARD.BREAK_POWER; 
        person.int += G_CONFIG.REWARD.BREAK_INT;
        person.charm += G_CONFIG.REWARD.BREAK_CHARM;
        person.maxAP = nextRealm.ap || person.maxAP;
        // ▼▼▼ 新增：突破成功，斩杀心魔 ▼▼▼
if (person.buffs && person.buffs.xin_mo_yu) {
            delete person.buffs.xin_mo_yu; // 移除心魔
            addLog(`【斩除心魔】随着境界的升华，那缠绕你许久的粉色欲念烟消云散！道心重归清明。`, "#2ecc71");
        }
        let successMsg = `突破成功！你踏入了 <strong>${nextRealm.name}</strong> 之境！`;

        if (eventMsg === "perfect_foundation") {
            let trait = DB.traits.find(t => t.name === "天道筑基");
            if (trait && !person.traits.some(t => t.name === trait.name)) {
                person.traits.unshift(trait);
                person.int += trait.buff.int;
                person.charm += trait.buff.charm;
                successMsg += `<br><span style="color:#f1c40f">【天道筑基】紫气东来，你成就了传说中的完美道基！</span>`;
            }
        }
        else if (eventMsg === "golden_core_grade") {
            if (Math.random() * 100 < person.int) {
                 let trait = DB.traits.find(t => t.name === "一品金丹");
                 if (trait) {
                     person.traits.unshift(trait);
                     person.power += trait.buff.power;
                     successMsg += `<br><span style="color:#e67e22">【一品金丹】丹成九纹，震烁古今！战力暴涨！</span>`;
                 }
            } else {
                successMsg += `<br>你结成了凡品金丹，虽无缘大道。`;
            }
        }
        else if (isDeathRisk) {
            successMsg += `<br><span style="color:#e74c3c">【渡劫成功】你沐浴雷火重生，寿元大增！</span>`;
        }

        return { success: true, msg: successMsg, chance: finalChance };

    } else {
        // === 突破失败 ===
        if (isDeathRisk) {
            // ... (这部分保持不变，处理死亡逻辑)
            person.isDead = true; 
            person.deathReason = "在化神雷劫中灰飞烟灭";
            let loc = person.location && typeof getLocationName === 'function' ? getLocationName(person.location) : "未知之地";
            History.record(person, 'life', `冲击化神境界失败，于 [${loc}] 遭遇九九天劫，肉身崩毁，身死道消。`);
            
            addLog(`【陨落】巨雷轰鸣，<strong>${person.name}</strong> 渡劫失败，当场身死道消！`, "#c0392b");
            return { success: false, isDead: true, msg: `渡劫失败！九九天劫之下，你已化为劫灰...`, chance: finalChance };
        } else {
            // =================================================
            // ▼▼▼ R18 心魔劫 (粉红幻境) 判定 (新增) ▼▼▼
            // =================================================
            const isR18 = (gameState.settings && gameState.settings.enableR18);
            // 触发条件：是玩家 + 开启R18 + (智力<40 容易中招 OR 30%随机倒霉)
            const isPinkEvent = isPlayer && isR18 && (person.int < 40 || Math.random() < 0.3);

            if (isPinkEvent) {
                // --- 1. 惩罚转化 ---
                // 身体被掏空，但修为散得比普通失败少一点 (只扣 2%)
                let penalty = Math.floor(person.power * 0.02); 
                person.power = Math.max(0, person.power - penalty);

              // --- 2. 获得 Debuff：心魔·幻欲 (改名) ---
                if (!person.buffs) person.buffs = {};
                person.buffs.xin_mo_yu = true; // <--- 变量名改了，更通用
                
                // --- 3. 因祸得福：魅力暴涨 ---
                person.charm += 20;
                
                // --- 4. R18 黄暴文案 ---
               let r18Msg = `
                    <br><br><span style="color:#e91e63; font-weight:bold;">【❤️ 心魔滋生】</span><br>
                    你紧守灵台试图冲关，却不料道心有缺，被域外天魔钻了空子。<br>
                    “修什么长生大道？不如极乐逍遥……”<br>
                    你紧守灵台试图冲关，却突觉小腹升起一股难以言喻的燥热。<br>
                    眼前的景象开始扭曲，无数粉色的雾气化作缠绵的肢体将你死死缠绕，耳边全是令人面红耳赤的喘息声...<br>
                    那声音如泣如诉，勾起了你心底最深处的渴望。你在幻境中被迫经历了数百次高潮，待你浑身虚脱地醒来时，发现亵衣已湿透，腿心一片狼藉。<br>
                    你虽保住了性命，但灵台中却多了一道粉色的<strong>【欲念心魔】</strong>。它厌恶枯燥的打坐，唯有在男女欢好之时才会兴奋地帮你吞噬灵气。
                    <br><span style="color:#c0392b; font-size:12px;">(获得状态：心魔·幻欲 —— 魅力+20，独修效率-30%，但双修收益+50%。<br>此状态将在下一次突破成功后消除。)</span>
                `;

                return { 
                    success: false, 
                    msg: `突破失败！道心失守，心魔入体...${r18Msg}`,
                    chance: finalChance
                };
            }

            // =================================================
            // ▼▼▼ 原有逻辑：普通失败 (保持不变) ▼▼▼
            // =================================================
            // ▼▼▼ 修改点：使用配置的惩罚比例 (0.1, 0.2, 0.3) 和 阈值 (80, 40) ▼▼▼
            let penaltyPercent = G_CONFIG.RATE.FAIL_PENALTY_LOW; 
            let failTitle = "突破失败";
            
            if (!isPlayer) {
                if (person.darkness > G_CONFIG.THRESHOLD.DARK_FAIL_HIGH) {
                    penaltyPercent = G_CONFIG.RATE.FAIL_PENALTY_HIGH; // 走火入魔
                    failTitle = "【走火入魔】心魔反噬";
                } else if (person.darkness > G_CONFIG.THRESHOLD.DARK_FAIL_MID) {
                    penaltyPercent = G_CONFIG.RATE.FAIL_PENALTY_MID; // 心神不宁
                    failTitle = "【心障难破】心神不宁";
                }
            }

            let penalty = Math.floor(person.power * penaltyPercent);
            person.power = Math.max(0, person.power - penalty);
            
            return { 
                success: false, 
                msg: `${failTitle}！真气逆行，修为倒退 <strong>${penalty}</strong> 点。`,
                chance: finalChance
            };
        }
    }
}
// --- 场景移动逻辑 (v0.34 新增) ---
export function handleTravel(targetLocId) {
    const p = gameState.player;
    const currentLoc = p.location;
    
    // 1. 获取耗时
    let months = getTravelTime(currentLoc, targetLocId);
    if (months <= 0) return; // 原地不动

    let targetName = LOCATIONS[targetLocId].name;
    addLog(`----------- 踏上旅途 -----------`, "#34495e");
    addLog(`你收拾行囊，从 [${getLocationName(currentLoc)}] 前往 [${targetName}]，路途遥远，需耗时 ${months} 个月。`, "#34495e");

    // 2. 开始模拟路途中的每个月
    let totalGain = 0; // 累计路途获得的修为

    for (let i = 0; i < months; i++) {
        // 2.1 时间流逝
        gameState.totalMonths++;
        p.age = Math.floor(gameState.totalMonths / G_CONFIG.DURATION.YEAR_MONTHS) + G_CONFIG.AGE.ADULT; // 简单修正年龄

        // 2.2 玩家路途修炼 (50% - 80% 效率)
        // 获取当前境界的基础修炼速度 (借助 growAttributes 里的逻辑简化版)
        let baseSpeed = G_CONFIG.RATE.TRAVEL_SPEED_BASE + (p.int * G_CONFIG.RATE.TRAVEL_INT_BONUS); 
        // 随机一个 0.5 ~ 0.8 的系数
        let ratio = G_CONFIG.RATE.TRAVEL_RATIO_MIN + Math.random() * G_CONFIG.RATE.TRAVEL_RATIO_RANGE; 
        
        let monthGain = Math.floor(baseSpeed * ratio);
        p.power += monthGain;
        totalGain += monthGain;

        // 2.3 NPC 也要生活 (复用 growAttributes)
        // 注意：这里我们只让 NPC 成长，不处理复杂的交互(handleNPCInteractions)，
        // 因为你在赶路，看不到他们打架，为了性能也为了逻辑简单。
        gameState.npcs.forEach(n => {
            growAttributes(n);
            // 简单的年龄增长
            if (gameState.totalMonths % G_CONFIG.DURATION.YEAR_MONTHS === 1) n.age++;
        });
        gameState.children.forEach(c => {
            growAttributes(c);
            if (gameState.totalMonths % G_CONFIG.DURATION.YEAR_MONTHS === 1) c.age++;
        });
    }

    // 3. 到达目的地
    p.location = targetLocId;
    // 【新增】所有被你囚禁的 NPC 也会被你一路拖着走，地点始终和你同步
    gameState.npcs.forEach(n => {
        if (n.isImprisoned) n.location = targetLocId;
    });
    
    // 4. 结算日志
    addLog(`经过 ${months} 个月的长途跋涉，你终于抵达了 <strong>${targetName}</strong>。`, "#27ae60");
    addLog(`【路途感悟】赶路途中你亦未忘修行，共获得修为 +${totalGain}`, "#f1c40f");
    
    // 5. 刷新界面 (由调用方 main.js 处理，或者这里也可以不用处理)
    return true;
}
// --- 场景特色功能 (v0.34 新增) ---

// 1. 宗门任务 (稳健获取灵石)
export function handleSectMission() {
    const p = gameState.player;
    const cfg = G_CONFIG.MISSION.SECT;
    addLog(`----------- 宗门任务 -----------`, "#3498db");
    
    passTime(1);
    
    // 收益计算 (受智力影响)
    let stones = cfg.BASE_STONES + Math.floor(p.int * cfg.INT_MULT_STONES) + Math.floor(Math.random() * cfg.VAR_STONES);
    let cultivation = cfg.BASE_CULTIVATION + Math.floor(p.int * cfg.INT_MULT_CULTIVATION);

    p.spiritStones = (p.spiritStones || 0) + stones;
    p.power += cultivation;

    addLog(`你领取了宗门派遣的杂务，兢兢业业工作了一个月。`, "#34495e");
    addLog(`【收益】获得灵石 +${stones}，修为 +${cultivation}`, "#2ecc71");
    
    return true; // 告诉主程序刷新界面
}

// 2. 坊市淘宝 (修改版：只买不吃)
export function handleMarketTrade() {
    const p = gameState.player;
    let cost = G_CONFIG.MARKET.BASIC_ITEM_COST; // 价格

    // 检查钱够不够
    if ((p.spiritStones || 0) < cost) {
        // 简单的提示，以后可以用 toast
        alert(`灵石不足！囊中羞涩，店主白了你一眼。(需 ${cost} 灵石)`);
        return false;
    }

    addLog(`----------- 坊市淘宝 -----------`, "#e67e22");
    
    // 扣钱
    p.spiritStones -= cost;
   passTime(1);

    // ▼▼▼ 修改点：只获得物品，不直接加属性 ▼▼▼
    p.items.push(G_CONFIG.MARKET.BASIC_ITEM_NAME); 

    addLog(`你花费 ${cost} 灵石，购得一瓶【${G_CONFIG.MARKET.BASIC_ITEM_NAME}E】，小心翼翼地收入储物袋中。`, "#34495e");
    
    // 刷新界面
    return true;
}

/**
 * v0.58 探索移动逻辑
 * @param {string} action - 'move' (切换方向), 'deeper' (深入), 'back' (后退)
 * @param {string} dir - 方向
 */
export function handleWildExplore(action, dir = null) {
    const ws = gameState.wildStatus;
    const dirNames = { north: "北原", south: "南荒", east: "东林", west: "西矿", center: "中谷" };
    const depthNames = ["表层", "中层", "深层", "核心区域"];

    if (action === 'move') {
        ws.direction = dir;
        ws.depth = 0; // 切换方向回到该方向的表层
        addLog(`你转身向[${dirNames[dir]}]走去，目前处于：${depthNames[0]}`, "#3498db");
    } 
    else if (action === 'deeper') {
        if (ws.depth < 3) {
            ws.depth += 1;
            addLog(`你拨开迷雾，继续深入[${dirNames[ws.direction]}]，目前到达：${depthNames[ws.depth]}`, "#8e44ad");
        } else {
            addLog("前方已是禁地核心，魔气森森，无法再深入了！", "#c0392b");
        }
    } 
    else if (action === 'back') {
        if (ws.depth > 0) {
            ws.depth -= 1;
            addLog(`你选择向外撤离，回到了[${dirNames[ws.direction]}]的${depthNames[ws.depth]}`, "#3498db");
        } else {
            ws.direction = 'center';
            addLog("你退出了特定区域，回到了大山入口（中谷）", "#7f8c8d");
        }
    }
    
    if (window.updateUI) window.updateUI();
}

// 别忘了挂载到全局
window.handleWildExplore = handleWildExplore;


const depth = gameState.wildStatus.depth; 
 const direction = gameState.wildStatus.direction;

export function handleGather() {
    const p = gameState.player;
    const cfg = G_CONFIG.SKILL_DATA; 
    
    // --- 关键修改：自动读取当前探索位置 ---
    const direction = gameState.wildStatus.direction; 
    const dIdx = gameState.wildStatus.depth; // 0, 1, 2, 3
    // ------------------------------------

    if (gameState.player.ap < 1) {
        if (window.showAlert) window.showAlert("精力不足！");
        return;
    }

    if (!p.skills.gathering) p.skills.gathering = { level: 0, exp: 0 };
    let g = p.skills.gathering;

    // 2. 消耗与增加经验
    gameState.player.ap -= 1;
    g.exp += cfg.EXP_PER_ACTION;

    // 3. 计算当前等级所需的非线性经验
    let nextExp = getUpgradeExp(g.level);

    // 产出数量与质量计算
    let amount = 1 + Math.floor(g.level / cfg.YIELD_STEP); 
    let roll = Math.random() * 100 + (g.level * cfg.LUCK_MULT);

    // 掉落池：根据当前深度 dIdx 自动选择
    const depthKeys = ["outer", "deep", "core", "core"]; // 映射到你的 LOOT_TABLE
    let currentDepthKey = depthKeys[dIdx];

    const LOOT_TABLE = {
        east:  { outer: ["普通药草", "碎石"], deep: ["百草液", "灵木"], core: ["千年灵芝", "天青花"] },
        west:  { outer: ["铁矿", "碎石"],     deep: ["精铜", "寒铁"],   core: ["玄铁精金", "庚金"] },
        south: { outer: ["火石", "灰烬"],     deep: ["赤火砂", "硫磺"], core: ["地火精粹", "火精钻"] },
        north: { outer: ["冰晶", "冷泉水"],   deep: ["寒霜叶", "玄冰"], core: ["冰晶髓", "极北寒铁"] },
        center:{ outer: ["杂草", "泥土"],     deep: ["灵石残片", "灵气水"], core: ["麒麟竭", "化神草"] }
    };
    
    let pool = LOOT_TABLE[direction][currentDepthKey];
    
    let resultItems = [];
    for (let i = 0; i < amount; i++) {
        let item = (roll > 85) ? (pool[2] || pool[0]) : ((roll > 50) ? (pool[1] || pool[0]) : pool[0]);
        resultItems.push(item);
        p.items.push(item);
    }

  // 4. 升级判定
    if (g.exp >= nextExp && g.level < cfg.MAX_LEVEL) {
        g.exp -= nextExp;
        g.level += 1;
        addLog(`🎉 采风撷灵！你的采集技艺精进至 Lv.${g.level}`, "#d35400");
    }

    const dirNames = { east: "东林", west: "西矿", south: "南荒", north: "北原", center: "中谷" };
    addLog(`你在[${dirNames[direction]}]深处进行采集，获得了：[${resultItems.join(', ')}]`, "#27ae60");

    if (window.updateUI) window.updateUI();
}

/**
 * v0.56 完整狩猎逻辑 (精准对接你的 HUNT 配置)
 */
/**
 * v0.56 完整狩猎逻辑 (修正版：加入技能等级加成)
 */
export function handleWildHunt() {
    const p = gameState.player;
    const ws = gameState.wildStatus;
    const cfg = G_CONFIG.HUNT;
    const dIdx = gameState.wildStatus.depth; // 0:表层, 1:中层, 2:深层, 3:核心
let buffs = getEquipmentBuffs();
    // 1. 技能初始化与升级
    if (!p.skills.hunting) p.skills.hunting = { level: 0, exp: 0 };
    let h = p.skills.hunting;
    
    // 检查精力
    if (gameState.player.ap < 1) {
         if (window.showAlert) window.showAlert("精力不足！");
         return;
    }
    gameState.player.ap -= 1;

    // 增加经验 (基础30 + 智力修正)
    h.exp += 30 + (p.int * 0.5); 

    // 升级判定
    // 假设 getUpgradeExp 已挂载到 window，如果没有则使用简易公式
    let nextExp = window.getUpgradeExp ? window.getUpgradeExp(h.level) : (100 * Math.pow(1.5, h.level));
    if (h.exp >= nextExp && h.level < (G_CONFIG.SKILL_DATA ? G_CONFIG.SKILL_DATA.MAX_LEVEL : 10)) {
        h.exp -= nextExp;
        h.level += 1;
        addLog(`⚔️ 杀伐果断！你的狩猎技艺提升至 Lv.${h.level}`, "#c0392b");
    }

    addLog(`----------- 在深山中巡视狩猎 (Lv.${h.level}) -----------`, "#c0392b");

    // --- 核心逻辑：深度越高危险越大，但技能等级可以降低危险 ---
    // 基础危险率：每深一层 +15%
    // 技能减免：每级减少 3% 危险率
    let dangerChance = (dIdx * 0.15) - (h.level * 0.03) - (buffs.attack * 0.001);
    // 随机波动：0 ~ 1.0
    let roll = Math.random();

    // 判定遭遇危险 (roll 小于 dangerChance 算倒霉，或者反过来逻辑)
    // 这里我们用：roll < dangerChance 代表遇到了打不过的硬茬
    // 举例：深层(0.3) - Lv5(0.15) = 0.15。即 15% 几率翻车。
    if (roll < dangerChance) { 
        let dmg = cfg.DMG_BASE + (dIdx * 20); 
        // 狩猎等级高也能减伤
        dmg = Math.max(10, dmg - (h.level * 2));
        
        p.power = Math.max(0, p.power - dmg); 
        addLog(`你遭遇了凶猛的高阶妖兽！虽然拼死抵抗，但仍不敌逃跑。`, "#c0392b");
        addLog(`【损失】修为倒退 -${dmg}`, "#7f8c8d");
    } 
    else {
        // === 狩猎成功 ===
        
        // 1. 计算收益倍率 (深度倍率 + 技能倍率)
        // 技能每级提供 10% 的额外灵石/修为收益
        let bonusMult = 1 + (dIdx * 0.5) + (h.level * 0.1) + buffs.hunting_rate; 
        
        let cultivation = Math.floor((cfg.CULTIVATION_NORMAL_BASE + (p.int * cfg.CULTIVATION_NORMAL_INT_MULT)) * bonusMult);
        let stones = Math.floor((cfg.STONES_NORMAL_BASE + Math.random() * 20) * bonusMult);
        
        p.power += cultivation;
        p.spiritStones += stones;

        // 2. 战利品掉落逻辑 (质量与数量)
        const monsterParts = ["妖兽精血", "坚固的兽爪", "厚重的兽皮", "高阶妖丹"];
        
        // 【质量】：技能等级提高获取稀有素材的概率
        // 基础池子位置：深度的一半
        let baseIndex = Math.floor(dIdx / 2);
        // 技能修正：每 3 级可以够得着更高一阶的素材
        let skillBonusIndex = Math.floor(h.level / 3);
        
        // 随机波动 0~1，加上技能修正
        let lootRoll = Math.floor(Math.random() * 2) + baseIndex + skillBonusIndex;
        // 封顶
        let lootIdx = Math.min(monsterParts.length - 1, lootRoll);
        let loot = monsterParts[lootIdx];
        
        p.items.push(loot);
        let itemLog = `[${loot}]`;

        // 【数量】：技能等级提供“双倍掉落”概率
        // 每级 5% 概率双倍
        if (Math.random() < (h.level * 0.05)) {
            p.items.push(loot);
            itemLog += ` x2 (技艺加成)`;
        }

        addLog(`你运用娴熟的技巧猎杀了妖兽，剥取获得：${itemLog}`, "#34495e");
        addLog(`【收益】灵石 +${stones}，修为 +${exp}`, "#2ecc71");
    }

    if (window.updateUI) window.updateUI();
}

// 统一挂载
window.handleGather = handleGather;
window.handleWildHunt = handleWildHunt;
// [logic.js] 只有当它是"懵懂"状态，且年龄达到 16 岁时触发
function resolveChildPersonality(person) {
    // 1. 寻找父母 (用于性格和外貌遗传)
    let father = person.fatherId ? findPerson(person.fatherId) : null;
    let mother = person.motherId ? findPerson(person.motherId) : null;

    // --- A. 性格定型 (原逻辑) ---
    const getCat = (p) => {
        if (!p) return null;
        if (p.id === gameState.player.id) return 'GOOD'; 
        return p.personality.category || 'NEUTRAL';
    };
    let parentsType = { father: getCat(father), mother: getCat(mother) };
    let newPersonality = generatePersonality(person.gender, parentsType);
    person.personality = newPersonality;

    // --- B. 外貌定型 (新增逻辑) ---
    // 调用 GeneService 生成一套成年人外貌 (传入 age=16)
    let newAppearance = GeneService.generateAppearance(father, mother, person.gender, G_CONFIG.AGE.ADULT);
    person.appearance = newAppearance;
    
    // 更新外貌描述文本
    person.appearanceDesc = Text.getAppearanceDesc(person);
    
    // 重新计算魅力值 (成年女大十八变)
    let beautyBonus = (newAppearance.beautyScore || G_CONFIG.RATE.DEFAULT_BEAUTY) * G_CONFIG.RATE.CHARM_BEAUTY_MULT;
    // 加上性格修正、随机波动
    person.charm = Math.floor(beautyBonus + randomInt(0, G_CONFIG.RATE.CHARM_VAR_RANGE));
    
    // 应用特质加成 (防止特质加的魅力被覆盖)
    person.traits.forEach(t => {
        if(t.buff && t.buff.charm) person.charm += t.buff.charm;
    });

    // ---------------------------

    // 记录日志
    let parentMsg = (father || mother) ? `受父母耳濡目染，` : "";
    History.record(person, 'life', `年满${G_CONFIG.AGE.ADULT}，行完成年之礼。${parentMsg}养成了 [${newPersonality.name}] 的性情，容貌也长开了。`);
    
    // 只有重要人物发全屏日志
    if (person.id === gameState.spouseId || gameState.children.some(c=>c.id === person.id)) {
        addLog(`【吾家有娃初长成】${linkName(person)} 已满${G_CONFIG.AGE.ADULT}岁！\n性格定型为 <strong>${newPersonality.name}</strong>，褪去稚气，展露真容。`, "#9b59b6");
    }
}
// [logic.js] 新增：灵魂回响判定系统
// -----------------------------------------------------------

// 1. 计算识破概率 (返回 0~100)
export function checkSoulEchoCondition(npc) {
    const cfg = G_CONFIG.SOUL_ECHO;
    
    // 获取上一世的 ID (也就是现在的母亲 ID)
    let prevLifeId = gameState.player.motherId; 
    if (!prevLifeId) return 0; // 如果你是第一代，或者不是夺舍来的，没人认识你
    
    // ★★★ 强力判定逻辑 ★★★
    // 我们直接查 NPC 的关系列表里，是否有 prevLifeId，且数值很高
    let prevRel = npc.relationships[prevLifeId] || 0;
    
    // 只有关系极深的人才有感应 (好感 > 80 或 仇恨 < -80)
    if (Math.abs(prevRel) < cfg.MIN_RELATION_LIMIT) return 0;
    
    // 概率计算
    // 基础概率 5%
    let chance = cfg.BASE_CHANCE;
    
    // 1. 智力加成 (智商高的容易看穿)
    chance += npc.int * cfg.INT_BONUS_MULT; 
    
    // 2. 情感加成 (爱得越深，直觉越准)
    // 或者是恨得越深
    if (prevRel > cfg.HIGH_LOVE_LINE) chance += cfg.BONUS_LOVE; 
    if (prevRel < cfg.HIGH_HATE_LINE) chance += cfg.BONUS_HATE; // 仇人直觉更准
    
    // 3. 痴绝性格加成 (直觉怪物)
    if (npc.personality.name === "痴绝") chance += cfg.BONUS_OBSESSIVE;

    // 4. 距离加成：如果你主动去撩他 (好感度增加)，概率提升
    if (npc.favor > cfg.ACTIVE_FAVOR_LINE) chance += cfg.BONUS_ACTIVE;

    // 锁顶 80% (留点悬念)
    return Math.min(cfg.MAX_CHANCE_LIMIT, chance);
}

// 2. 触发识破事件
export async function triggerSoulEchoEvent(npc) {
    const cfg = G_CONFIG.SOUL_ECHO;
    if (window.playSound) window.playSound('popup');

    // 1. 获取前世关系数据
    let prevLifeId = gameState.player.motherId;
    let prevRel = npc.relationships[prevLifeId] || 0;
    let isLove = prevRel > 0; // 大于0是爱人，小于0是仇人
    
    // 2. 准备标题和初始氛围描述
    let title = isLove ? "【故人心悸】" : "【宿敌直觉】";
    const textLib = Text.Dialogue.SoulEcho;
    
    // 如果是爱人，用怀疑文案；如果是仇人，用默认的压迫感描述
    let initialDesc = isLove 
        ? randomChoice(textLib.suspicion) 
        : "他在阴影中死死盯着你，某种被血浸透的直觉在他脑海中疯狂作响。";
    
    // 3. 弹出三选一对话框
    let modalText = `${initialDesc}<br><br><strong>${npc.name}</strong> 的认知正在发生剧烈的崩塌。此时的举动将决定他的终局：<br><br>1. <strong>归位</strong> (让灵魂在皮囊中重现)<br>2. <strong>湮灭</strong> (让真相沉入岁月的荒冢)<br>3. <strong>支配</strong> (利用记忆彻底摧毁他的伦理防线)`;
    
    let choice = await showModal(title, modalText, 'prompt', "1");

    // --- 逻辑分支开始 ---
    
    if (choice === "1") {
        // 【选项1：承认/归位】
        if (isLove) {
            // 爱人相认：氛围感文案
            addLog(`${randomChoice(textLib.recognition)}`, "#e91e63");
            changeEmotion(npc, 'love', cfg.BONUS_ADMIT_LOVE);
            changeEmotion(npc, 'favor', cfg.BONUS_ADMIT_FAVOR);
            npc.isSoulMate = true; // 标记为灵魂伴侣
        } else {
            // 仇人相认：氛围感文案
            addLog(`${randomChoice(textLib.nemesis)}`, "#c0392b");
            npc.isNemesis = true;
            changeEmotion(npc, 'favor', cfg.PENALTY_ADMIT_HATE);
        }
    } 
    else if (choice === "3") {
        // 【选项3：玩弄/支配】—— 无论爱仇，皆可支配
        addLog(`${randomChoice(textLib.manipulation)}`, "#c0392b");
        
        // 核心后果：利用记忆造成的认知摧毁
        changeEmotion(npc, 'love', 50);      // 产生病态的依恋
        changeEmotion(npc, 'darkness', 80);  // 黑化值暴增
        npc.isSoulMate = true;               // 强行标记为奴隶
        
        addLog(`(天凤的阴影彻底覆盖了他的神智，伦理崩毁。)`, "#4d4d4e");
    } 
    else {
        // 【选项2：否认/湮灭】
        addLog(`你神色如常地移开视线，任由他眼底的那抹光亮一点点熄灭，重新归于死寂。`, "#7f8c8d");
        if (isLove) {
            changeEmotion(npc, 'love', cfg.BONUS_DENY_LOVE);
        }
    }
}
window.checkSoulEchoCondition = checkSoulEchoCondition;
window.triggerSoulEchoEvent = triggerSoulEchoEvent;
export function passTime(months = 1) {
    // 1. 强行检查一下状态（调试用，修好后可删除）
    if (gameState.isPlayerImprisoned) {
        console.log("进入过月逻辑：玩家处于囚禁状态，监禁者ID:", gameState.captorId);
    } else {
        console.log("进入过月逻辑：玩家未被囚禁");
    }

    for (let i = 0; i < months; i++) {
        // 1. 时间推进
        gameState.totalMonths++; 

        // 2. 只有在每年的第 1 个月，全员才长 1 岁
        // 逻辑：如果总月数能被 12 整除余 1，说明进入了新的一年
        let isNewYear = (gameState.totalMonths % G_CONFIG.DURATION.YEAR_MONTHS === 1);

        // 3. 玩家年龄同步
        gameState.player.age = Math.floor((gameState.totalMonths - 1) / G_CONFIG.DURATION.YEAR_MONTHS) + 16; 
        
        // 4. 全服 NPC 成长与寿命检查
        gameState.npcs.forEach(n => {
            growAttributes(n); 
            if (isNewYear) n.age++; // 只有过年才加岁数
        });
        
        // 5. 子嗣成长
        gameState.children.forEach(c => {
            growAttributes(c);
            if (isNewYear) c.age++; // 只有过年才加岁数
        });

        // 6. 怀孕进度自然增长
        gameState.npcs.forEach(async npc => {
            if (npc.isBirthing) return;
            if (npc.pregnancyProgress > 0) {
                npc.pregnancyProgress++;
            // --- 【新增】检查是否临盆 ---
        if (npc.pregnancyProgress >= (npc.birthTarget || 9)) {
            npc.isBirthing = true; 
            try {
                await birthBaby(npc);
            } finally {
                // 无论生产成功还是出错，最后都要解锁
                npc.isBirthing = false;
            await birthBaby(npc); 
        }
    }
    }
});
      
    // === 【新增】处理玩家被反向囚禁时的每日/月逻辑 ===
    if (gameState.isPlayerImprisoned) {
        const impCfg = G_CONFIG.IMPRISON; // 引用配置中心
        const captor = findPerson(gameState.captorId);
        
        if (captor) {
            if (Math.random() < 0.4) {
            const pName = captor.personality.name;
            const scenes = CAPTOR_SCENES[pName] || CAPTOR_SCENES["温润"];
            const randomScene = scenes[Math.floor(Math.random() * scenes.length)];
            
            addLog(`【囚笼】${randomScene}`, "#4d4d4e"); // 灰色字体增加压抑感
            }
            // 1. 监禁者每日/月黑化与扭曲爱意滋生
            // 使用配置：DAILY_DARKNESS_GAIN (5), DAILY_LOVE_GAIN (10)
            changeEmotion(captor, 'darkness', impCfg.DAILY_DARKNESS_GAIN); 
            changeEmotion(captor, 'love', impCfg.DAILY_LOVE_GAIN);         
            
            // 2. 强行占有时的怀孕判定
            // 使用配置：DAILY_PREGNANCY_CHANCE (0.3)
            if (Math.random() < impCfg.DAILY_PREGNANCY_CHANCE) {
                // 如果监禁者是异性，此处可触发玩家或监禁者的怀孕逻辑
                console.log(`【监禁事件】${captor.name} 强行占有了你...`);
            }

            // 3. 劫狱事件触发判定
            // 使用配置：RESCUE_ATTEMPT_CHANCE (0.3)
            if (Math.random() < impCfg.RESCUE_ATTEMPT_CHANCE) {
                // handleRescueAttempt 函数内部已对齐配置
                handleRescueAttempt(captor); 
            }
        }
    }
        // === 【新增】处理同地修罗场武斗 ===
    const locMap = {};
    // 找出所有对玩家有爱意的活人
    gameState.npcs.filter(n => n.love > 50 && !n.isDead && !n.isImprisoned).forEach(n => {
        if (!locMap[n.location]) locMap[n.location] = [];
        locMap[n.location].push(n);
    });

    for (let loc in locMap) {
        let lovers = locMap[loc];
        if (lovers.length >= 2) {
            // 随机选两位情敌
            let a = lovers[0];
            let b = lovers[1];
            addLog(`【修罗场】${a.name} 与 ${b.name} 在 ${getLocationName(loc)} 偶遇，两人因争风吃醋大打出手！`, "#c0392b");
            
            // 损耗修为与增加黑化
            a.power = Math.max(0, a.power - 10);
            b.power = Math.max(0, b.power - 10);
            a.darkness += 10;
            b.darkness += 10;
    }
}
    }
}
// [logic.js] 新增：长时间闭关核心逻辑
// 这是一个异步函数，防止卡死界面（虽然目前是同步循环，为Step3优化做准备）
window.executeSeclusion = async function(years) {
    const p = gameState.player;
    let totalMonths = years * 12;
    
    // 1. 播放音效与日志
    if(window.playSound) window.playSound('popup');
    addLog(`----------- 闭关开始 (${years}年) -----------`, "#8e44ad");
    addLog(`你封锁洞府，开始了长达 ${years} 年的潜修...`, "#8e44ad");

    let startPower = p.power;
    let startAge = p.age;
    
    // 2. 循环处理每一个月
    for (let i = 0; i < totalMonths; i++) {
        // A. 玩家修炼 (自动消耗AP获得收益)
        // 注意：growAttributes 内部会消耗当前 AP 并重置为满，
        // 所以循环调用它就能模拟每个月都修炼了。
        growAttributes(p, true);
        
        // B. 时间流逝 (NPC与子嗣自动成长、增加岁数)
        // 注意：passTime(1) 会增加 totalMonths，也会处理 NPC 的 growAttributes
        passTime(1); 
        
        // C. NPC 社交互动 (Step 3 重点优化对象)
        // 目前先直接调用，确保世界是活的。
        // 如果觉得日志太吵，我们下一阶段会加“日志过滤”。
        handleNPCInteractions(); 
        
        // D. 死亡检查 (如果你闭关太久老死了)
        if (p.isDead) {
            addLog(`【噩耗】你在闭关途中寿元耗尽，坐化于洞府之中...`, "#c0392b");
            break; // 停止闭关
        }
    }

    // 3. 结算
    let powerGain = p.power - startPower;
    addLog(`----------- 闭关结束 -----------`, "#8e44ad");
    addLog(`时光荏苒，${years} 年转瞬即逝。`, "#34495e");
    addLog(`本次闭关共增长修为: <strong>${powerGain}</strong> 点`, "#2ecc71");
    
    // 4. 刷新界面
    if(window.updateUI) window.updateUI();
};
// --- 【勒索系统】获取可勒索的亲友列表 ---
window.getBlackmailTargets = function(prisoner) {
    // 搜寻范围：父亲、母亲、配偶
    const relativeIds = [prisoner.fatherId, prisoner.motherId, prisoner.spouseId].filter(id => id && id !== 0);
    
    // 在全NPC中寻找这些人
    return gameState.npcs.filter(n => relativeIds.includes(n.id) && !n.isDead && !n.isImprisoned);
}
// --- 【新增】判定玩家是否被反向囚禁 ---
window.checkPlayerCaptured = function(npc) {
    const cfg = G_CONFIG.IMPRISON;
    const player = gameState.player;
    // 触发条件：爱意极高(>90) + NPC修为 > 玩家修为 + NPC没死没坐牢
    if (npc.love > cfg.TRIGGER_LOVE && npc.power > player.power && !npc.isDead && !npc.isImprisoned) {
        // 20% 几率触发
        if (Math.random() < cfg.TRIGGER_CHANCE) {
            gameState.isPlayerImprisoned = true;
            gameState.captorId = npc.id;
            
            // 强行把两人的位置同步 (地牢就在当前地点的深处)
            npc.location = player.location; 

            addLog(`【囚笼】${npc.name} 的眼神中闪过一丝病态的疯狂：竟将你囚禁在不为人知的地方！`, "#c0392b");
            // 这里可以直接弹出提示
            window.showAlert(`${npc.name} 凭借强横修为将你囚禁在他的洞府禁地中！你现在无法自由行动了。`, "禁锢警告");
            
            if(window.updateUI) window.updateUI();
            return true;
        }
    }
    return false;
};
window.passTime = passTime;
console.log("【系统】Logic.js 已加载，passTime 已强制挂载到 window");
// logic.js
// ... (之前的 imports)

/**
 * 处理营救事件 (劫狱系统)
 * @param {Object} captor - 当前的囚禁者对象
 */
export async function handleRescueAttempt(captor) {
    const cfg = G_CONFIG.IMPRISON;
    // 1. 筛选营救者：没死、没坐牢、爱意极高、不是当前的囚禁者
    // 软指标：爱意 > 90，且必须有一战之力（修为至少是囚禁者的 60%，否则就是送死）
    let rescuers = gameState.npcs.filter(n => 
        !n.isDead && 
        !n.isImprisoned && 
        n.id !== captor.id && 
        n.love >= cfg.RESCUE_LOVE_REQ && // 使用配置：90
        n.power > (captor.power *cfg.RESCUE_POWER_RATIO) // 使用配置：0.6
    );

    if (rescuers.length === 0) return; // 没人爱你，或者爱你的都太弱了

    // 2. 排序：谁最急？(按 爱意*0.4 + 修为*0.6 综合排序，或者简单点按修为排序)
    // 这里我们选一个“最强”的来救，增加成功率
    rescuers.sort((a, b) => b.power - a.power);
    let hero = rescuers[0]; // 选出救世主

    addLog(`----------- 劫狱事件 -----------`, "#e74c3c");
    addLog(`【突发】地牢外传来剧烈的灵力波动！${hero.name} 闯入了 ${captor.name} 的禁地！`, "#e67e22");

    // 3. 骨相与胜率 战力比 * 0.5
    let winRate = (hero.power / captor.power) * cfg.BATTLE_BASE_COEFF; 
    let logDetail = "";


    // 随机波动 (0.8 ~ 1.2)
    let roll = Math.random();
    let finalWinRate = winRate * (cfg.BATTLE_RNG_MIN + Math.random() * cfg.BATTLE_RNG_VAR);

    // 4. 决斗结算
    if (finalWinRate > 1.0 || roll < winRate) { // 赢了
        addLog(`【激战】${hero.name} 祭出本命法宝，与 ${captor.name} 大战三百回合！最终一招险胜！${logDetail}`, "#2ecc71");
        
        // --- 囚禁者战败惩罚 ---
        captor.power = Math.floor(captor.power * 0.7); // 修为大损
        addLog(`${captor.name} 负伤败退，不得不解开了禁制。`, "#7f8c8d");

        // === 5. 狗血分支：是救赎还是接盘？ ===
        // 判定条件：性格是“痴绝/偏执/市侩”，或者黑化值 > 60，或者正好是“病娇”
        // 还要加上一点随机性，让老实人也有可能黑化
        let isDarkHero = (hero.darkness > cfg.DARK_HERO_THRESHOLD) || 
                         ["痴绝", "偏执", "凶戾"].includes(hero.personality.name) ||
                         (Math.random() < cfg.DARK_HERO_CHANCE); // 20%几率随机黑化

        if (isDarkHero) {
            // ---> 结局 B: 二次囚禁 (接力锁)
            gameState.captorId = hero.id; // 变更囚禁者 ID
            // 囚禁状态依然为 true，不用改
            
            hero.darkness += cfg.CHAIN_DARKNESS; // 黑化更深+20
            hero.love += cfg.CHAIN_LOVE;     // 扭曲的爱意暴涨+50
            
            let darkWords = "“我也想放你走……可看到你虚弱的样子，我这里才最安全。”";
            if (hero.personality.name === "痴绝") darkWords = "“你是我的了……再也没有人能把你抢走。”";
            
            addLog(`【惊变】你以为重获自由，刚想离开，却听到“咔嚓”一声，那是镣铐重新锁上的声音。`, "#c0392b");
            addLog(`【接力】${hero.name} 擦去嘴角的血迹，眼神晦暗不明：${darkWords}`, "#c0392b");
            addLog(`(监禁者已变更为：${hero.name})`, "#7f8c8d");

        } else {
            // ---> 结局 A: 纯爱救赎
            gameState.isPlayerImprisoned = false;
            gameState.captorId = null;
            
           changeEmotion(hero, 'favor', cfg.SUCCESS_FAVOR); // +50
            changeEmotion(hero, 'love', cfg.SUCCESS_LOVE);   // +20
            
            addLog(`【获救】${hero.name} 冲过来一把抱住了你：“抱歉，我来晚了。”`, "#e91e63");
            addLog(`你重获自由！(外出功能已恢复)`, "#2ecc71");
            
            // 记得刷新UI让按钮亮起来
            if (window.updateUI) window.updateUI();
        }

    } else {
        // 输了
        addLog(`【败北】${hero.name} 虽拼死相救，奈何 ${captor.name} 修为通天，终是不敌！`, "#c0392b");
        
            // 普通人可能被打死0.3
            if (Math.random() < cfg.FAIL_DEATH_CHANCE) {
                // 结局 C: 战死
                hero.isDead = true;
                hero.deathReason = `为救你，被 ${captor.name} 斩杀于地牢前`;
                addLog(`【陨落】只见血光崩现，${hero.name} 被当场格杀！你眼睁睁看着他倒在血泊中...`, "#c0392b");
                
            } else {
                // 重伤逃逸使用配置中的中度失败扣除比例 (0.2)
                let penalty = Math.floor(hero.power * G_CONFIG.RATE.FAIL_PENALTY_MID);
                hero.power -= penalty;
                addLog(`${hero.name} 重伤呕血，不得不狼狈逃离。`, "#7f8c8d");
            }
        }
        
        // 囚禁者更加变态
        captor.darkness += cfg.FAIL_CAPTOR_DARKNESS;
        addLog(`【加固】${captor.name} 看着地上的血迹，冷笑着加固了禁制：“谁也别想带走你。”`, "#c0392b");
    }

window.handleRescueAttempt = handleRescueAttempt;
/**
 * v0.65 请教绝技 (狗血流交互逻辑)
 * 增加位置：文件末尾
 */
// logic.js 底部

/**
 * v0.68 终极防爆版请教绝技
 * 自动适配：有 showModal 用 showModal，没有就用 alert
 */
export function handleTeachSkill(npcId) {
    // 1. 获取数据
    const p = gameState.player;
    const npc = gameState.npcs.find(n => n.id == npcId);
    if (!npc) return console.error("找不到NPC:", npcId);

    // --- 内部工具：安全弹窗 ---
    const safeAlert = (title, msg) => {
        if (typeof showModal === 'function') {
            showModal(title, msg, "alert"); // 游戏内弹窗
        } else if (window.showModal) {
            window.showModal(title, msg, "alert"); // 全局弹窗
        } else {
            alert(`【${title}】\n${msg}`); // 浏览器自带弹窗(保底)
        }
    };

    // 2. 冷却检查
    if (gameState.monthlyLearned) {
        safeAlert("提示", "本月已请教过绝学，贪多必失，下月再来吧！");
        return;
    }

    // 3. 门派判定
    // 丹鼎阁 (支持 dan_ding 和 danding)
    if (npc.homeSect === "dan_ding" || npc.homeSect === "danding") {
        const reqItem = "千年灵芝";
        
        // 检查背包
        // 注意：p.items 可能是数组(旧版)也可能是对象(新版)，这里做兼容
        let hasItem = false;
        let itemKey = reqItem;
        
        if (Array.isArray(p.items)) {
            // 数组模式
            if (p.items.includes(reqItem)) hasItem = true;
        } else if (gameState.bag && gameState.bag[reqItem] > 0) {
            // 对象/背包模式
            hasItem = true;
        }

        if (!hasItem) {
            safeAlert("丹鼎阁主", `【${npc.name}】冷哼一声：“空手套白狼？去大山核心采一株 [${reqItem}] 献给本座再谈！”`);
            return;
        }

        // --- 核心执行 ---
        try {
            // 扣除物品 (兼容数组和对象背包)
            if (Array.isArray(p.items)) {
                p.items.splice(p.items.indexOf(reqItem), 1);
            } else if (gameState.bag) {
                gameState.bag[reqItem]--;
                if (gameState.bag[reqItem] <= 0) delete gameState.bag[reqItem];
            }

            // 加经验
            let gain = learnSkillLogic(npc, 'alchemy');

            // 成功弹窗
            safeAlert("指点迷津", `叶灵枢收下了灵芝，随手指点了一番。\n\n【炼丹造诣 +${gain}】\n(当前: Lv.${p.skills.alchemy.level})`);
            
            // 标记完成
            gameState.monthlyLearned = true;
            if (typeof updateUI === 'function') updateUI();
            else if (window.updateUI) window.updateUI();

        } catch (e) {
            console.error("代码报错了:", e);
            alert("发生错误，请截图控制台给开发者：" + e.message);
        }
    } 
    // ... (其他门派逻辑可暂时省略，先测通丹鼎阁) ...
    else {
        safeAlert("缘分未到", "此人暂无功法可教。");
    }
}

/**
 * 技能升级逻辑 (带自动初始化)
 */
function learnSkillLogic(npc, skillKey, bonus = 1) {
    const p = gameState.player;
    // 1. 确保 skills 存在
    if (!p.skills) p.skills = {};
    // 2. 确保具体技能存在
    if (!p.skills[skillKey]) p.skills[skillKey] = { level: 0, exp: 0 };

    // 3. 计算经验
    const cfg = (window.G_CONFIG && window.G_CONFIG.TEACH) ? window.G_CONFIG.TEACH : { BASE_GAIN: 20, INT_BONUS_MULT: 0.5 };
    let gain = Math.floor((cfg.BASE_GAIN + ((p.int||0) * cfg.INT_BONUS_MULT)) * bonus);
    
    // 4. 加经验
    let g = p.skills[skillKey];
    g.exp += gain;

    // 5. 升级循环
    while (true) {
        let nextExp = (g.level + 1) * 100 * 1.5; // 简化公式防报错
        if (window.getUpgradeExp) nextExp = window.getUpgradeExp(g.level);

        if (g.exp >= nextExp) {
            g.exp -= nextExp;
            g.level++;
        } else {
            break;
        }
    }

    // 6. 必须返回数值！
    return gain;
}
function getUpgradeExp(level) {
    // 确保能读到配置，读不到就用默认值兜底
    const cfg = (window.G_CONFIG && window.G_CONFIG.SKILL_DATA) ? window.G_CONFIG.SKILL_DATA : { BASE_EXP: 100, EXP_MULTIPLIER: 1.5 };
    
    // 核心公式：100 * (1.5 ^ level)
    return Math.floor(cfg.BASE_EXP * Math.pow(cfg.EXP_MULTIPLIER, level));
}

// 挂载到 window 方便调试
window.getUpgradeExp = getUpgradeExp;
window.learnSkillLogic = learnSkillLogic;
window.handleTeachSkill = handleTeachSkill;
/**
 * v0.70 生产制造系统核心 (炼丹/炼器)
 * @param {string} type - 'alchemy' 或 'forging'
 * @param {string} recipeId - 配方ID
 */
export function handleCraft(type, recipeId) {
    const p = gameState.player;
    const allRecipes = G_CONFIG.RECIPES[type];
    const recipe = allRecipes.find(r => r.id === recipeId);

    if (!recipe) return console.error("配方不存在");

    // 1. 检查精力
    if (gameState.player.ap < recipe.costAP) {
        if(window.showAlert) window.showAlert("精力不足！无法开炉。");
        return;
    }

    // 2. 检查材料 (兼容 items 为数组的情况)
    // 我们先把背包整理成 { "草药": 5, "石头": 2 } 这种格式方便查询
    let bagCounts = {};
    if (Array.isArray(p.items)) {
        p.items.forEach(item => {
            bagCounts[item] = (bagCounts[item] || 0) + 1;
        });
    } else {
        bagCounts = p.items || {}; // 兼容旧对象背包
    }

    let missing = [];
    for (let matName in recipe.materials) {
        let reqNum = recipe.materials[matName];
        if ((bagCounts[matName] || 0) < reqNum) {
            missing.push(`${matName} (缺${reqNum - (bagCounts[matName] || 0)})`);
        }
    }

    if (missing.length > 0) {
        if(window.showAlert) window.showAlert(`材料不足：<br>${missing.join('<br>')}`);
        return;
    }

    // 3. 消耗精力 & 材料
    gameState.player.ap -= recipe.costAP;
    
    // 扣除材料逻辑
    for (let matName in recipe.materials) {
        let reqNum = recipe.materials[matName];
        // 如果是数组背包，需要删掉对应数量的项
        if (Array.isArray(p.items)) {
            for(let i=0; i<reqNum; i++) {
                let idx = p.items.indexOf(matName);
                if(idx !== -1) p.items.splice(idx, 1);
            }
        } 
        // 对象背包逻辑
        else if (p.items) {
            p.items[matName] -= reqNum;
            if(p.items[matName] <= 0) delete p.items[matName];
        }
    }

    // 4. 技能熟练度处理
    if (!p.skills[type]) p.skills[type] = { level: 0, exp: 0 };
    let skill = p.skills[type];
    
    // 无论成败，都增加经验 (带智力加成)
    let expGain = Math.floor(recipe.exp * (1 + p.int * 0.005)); 
    skill.exp += expGain;
    
    // 自动升级检查
    let nextExp = window.getUpgradeExp ? window.getUpgradeExp(skill.level) : 100;
    if (skill.exp >= nextExp && skill.level < 10) {
        skill.exp -= nextExp;
        skill.level++;
        addLog(`📈 【技艺精进】你的${type === 'alchemy' ? '炼丹' : '炼器'}术达到了 Lv.${skill.level}！`, "#e67e22");
    }

    // 5. 成功率计算 (基础 + 熟练度加成)
    // 每级增加 5% 成功率
    let successRate = recipe.baseChance + (skill.level * 0.05);
    successRate = Math.min(0.95, successRate); // 锁顶 95%，留点悬念

    // 6. 结果判定
    if (Math.random() < successRate) {
        // === 🎉 成功 ===
        let qty = 1 + Math.floor(skill.level / 5);
        let critRate = skill.level * 0.03;
        let isRare = Math.random() < critRate;
        
        let finalItemName = isRare ? recipe.output.rare : recipe.output.normal;
        
        // --- 🆕 装备属性与器灵逻辑 ---
        let buff = isRare ? recipe.output.rareBuff : recipe.output.normalBuff;
        let hasSpirit = isRare && recipe.output.hasSpirit; // 只有配方里标记了且是极品，才有机会

        // 发放物品
        for(let i=0; i<qty; i++) {
            p.items.push(finalItemName);
        }

        let extraLog = "";
        
        // ★★★ 器灵诞生逻辑 ★★★
        // 条件：是极品神剑 + 10% 概率 (或者看智力/炼器等级)
        if (hasSpirit && Math.random() < 0.2) { // 20% 概率出器灵
            // 1. 创建器灵 NPC
            let spirit = createPerson(false); // 创建一个空壳
            
            // 2. 设定外貌 (苍白肤色，白发，黑瞳)
            spirit.appearance = spirit.appearance || {};
            // 强制设定颜色过滤器 (filters)
            if(!spirit.appearance.skins) spirit.appearance.skins = {};
            spirit.appearance.skins.filter = "brightness(1.5) grayscale(0.8)"; // 苍白
            
            if(!spirit.appearance.hair_colors) spirit.appearance.hair_colors = {};
            spirit.appearance.hair_colors.filter = "grayscale(1) brightness(2)"; // 白发
            
            if(!spirit.appearance.eye_colors) spirit.appearance.eye_colors = {};
            spirit.appearance.eye_colors.filter = "grayscale(1) brightness(0.2)"; // 黑瞳
            
            // 3. 设定属性
            spirit.name = `剑灵·${spirit.name.split(' ')[0] || '白'}`; // 名字带前缀
            spirit.gender = Math.random() > 0.5 ? "女" : "男";
            spirit.homeSect = "器灵"; // 归属地
            spirit.location = p.location; // 就在你身边
            
            // 4. 设定情感 (满好感满爱意)
            spirit.favor = 100;
            spirit.love = 100;
            spirit.relationships[p.id] = 100; // 它是为你而生的
            
            // 5. 设定特殊特质
            spirit.traits = [{
                name: "神兵剑灵",
                desc: "天地神物化灵，对主人绝对忠诚，自带锋锐之气。",
                grade: 5, // 红色神级
                buff: { attack: 50, charm: 20 }
            }];
            
            // 6. 加入世界
            gameState.npcs.push(spirit);
            
            extraLog = `<br><span style="color:#9b59b6; font-weight:bold; font-size:14px;">✨ 剑气冲霄，化而为灵！<br>恭喜你，锻造出的神剑诞生了器灵 [${spirit.name}]！</span>`;
            
            // 立即弹窗通知
            if(window.showModal) window.showModal("神迹降临", `炉火纯青，神兵有灵！<br>你看着从剑身中缓缓浮现的那个苍白身影...<br>它是独属于你的<strong>器灵</strong>。`);
        }

        let finalDesc = isRare ? `<span style="color:#e74c3c; font-weight:bold;">${finalItemName} (极品)</span>` : finalItemName;
        let verb = type === 'alchemy' ? '炼制' : '锻造';
        
        addLog(`🔥 【${verb}成功】你开炉${verb}，获得了 ${finalDesc} x${qty}${extraLog}`, "#2ecc71");
        
        if(!extraLog && window.showAlert) window.showAlert(`成功${verb}！<br>获得：${finalDesc} x${qty}`, "大功告成");

    } else {
        // === 💥 失败 ===
        addLog(`💥 【炸炉】火候未掌控好，材料化为了一缕黑烟... (经验 +${expGain})`, "#7f8c8d");
        if(window.showAlert) window.showAlert("失败了！<br>材料已损毁，只积累了一些经验。", "炸炉");
    }

    // 刷新界面
    if (window.updateUI) window.updateUI();
    // 保持制造界面打开，刷新数据
    if (window.openCraftingMenu) window.openCraftingMenu(type); 
}

// 挂载
window.handleCraft = handleCraft;
/**
 * 计算玩家背包内装备的总加成
 * @returns {Object} { attack: 0, defense: 0, hunting_rate: 0, speed: 0 }
 */
export function getEquipmentBuffs() {
    const p = gameState.player;
    let totalBuffs = { attack: 0, defense: 0, hunting_rate: 0, speed: 0 };
    
    // 遍历所有炼器配方，建立 "物品名 -> Buff" 的查找表
    // 这样做是为了不需要每次都遍历 config，但这儿简单起见直接查
    const recipes = G_CONFIG.RECIPES.forging;
    
    // 统计背包里的东西
    let bagItems = Array.isArray(p.items) ? p.items : Object.keys(p.items);
    
    bagItems.forEach(itemName => {
        // 在配方里找这个名字对应的产出
        let r = recipes.find(re => re.output.normal === itemName || re.output.rare === itemName);
        if (r) {
            let buff = null;
            if (r.output.normal === itemName) buff = r.output.normalBuff;
            if (r.output.rare === itemName) buff = r.output.rareBuff;
            
            if (buff) {
                // 累加属性 (注意：这里假设装备放在包里就生效，如果以后做装备槽，逻辑要改)
                if (buff.attack) totalBuffs.attack += buff.attack;
                if (buff.defense) totalBuffs.defense += buff.defense;
                if (buff.hunting_rate) totalBuffs.hunting_rate += buff.hunting_rate;
                if (buff.speed) totalBuffs.speed += buff.speed;
            }
        }
    });
    
    return totalBuffs;
}

// 挂载
window.getEquipmentBuffs = getEquipmentBuffs;
window.handleBreakthrough = handleBreakthrough;
// 顺便把这几个常用的也挂上去，方便以后测试
window.changeEmotion = changeEmotion; 
window.getDaoWeight = getDaoWeight;

console.log("【系统】Logic.js 已加载，handleBreakthrough 已挂载到 window");