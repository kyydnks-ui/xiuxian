// utils.js
// 通用工具函数与基因服务 (修复崩溃版 v0.29)
// ----------------------------------------------------------------
import { DB, REALMS, PERSONAS, PERSONA_KEYS, DAOS, DAO_KEYS } from './data.js';
import { Text } from './text.js';
import { gameState } from './state.js';

// --- 基础工具 ---
export function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 【修复1】给 randomChoice 穿上防弹衣，防止 undefined 导致崩溃
export function randomChoice(arr) { 
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)]; 
}

// --- 辅助函数：安全获取数据列表 (核心修复) ---
// 它可以把代码里的 "eye_shapes" 自动翻译成数据库里的 "eyes_female"
function getSafeList(key, gender) {
    let suffix = (gender === "女") ? "_female" : "_male";
    let dbKey = key;

    // 映射字典
    if (key === 'eye_shapes') dbKey = 'eyes' + suffix;       // eye_shapes -> eyes_female
    else if (key === 'face_shapes') dbKey = 'faces' + suffix;// face_shapes -> faces_female (如果你的DB叫face, 改成face)
    else if (key === 'hair_styles') dbKey = 'hair_styles' + suffix; // 修正：hair_styles -> hair_styles_female
    else if (key === 'eyebrows') dbKey = 'eyebrows' + suffix;// eyebrows -> eyebrows_female
    else if (key === 'noses') dbKey = 'noses' + suffix;
    else if (key === 'lips') dbKey = 'lips' + suffix;

    // 1. 尝试找映射后的名字 (eyes_female)
    let list = DB.appearance[dbKey];
    
    // 2. 如果没找到，尝试找原名 (skins)
    if (!list) list = DB.appearance[key];

    // 3. 返回列表，或者 null
    return (list && list.length > 0) ? list : null;
}

export function getRealmName(power) {
    for (let i = REALMS.length - 1; i >= 0; i--) {
        if (power >= REALMS[i].min) return REALMS[i].name;
    }
    return "凡人";
}

export function getRealmRank(power) {
    let name = getRealmName(power);
    if (name.includes("化神")) return 5;
    if (name.includes("元婴")) return 4;
    if (name.includes("金丹")) return 3;
    if (name.includes("筑基")) return 2;
    if (name.includes("炼气")) return 1;
    return 0; 
}

export function getCombatPower(person) {
    if (!person) return 0;
    let base = person.power;
    let rank = getRealmRank(person.power); 
    let rankMult = [1.0, 1.0, 1.5, 2.0, 3.0, 5.0][rank] || 1.0;
    
    if (rank === 2) rankMult = 1.5;      
    else if (rank === 3) rankMult = 2.0; 
    else if (rank === 4) rankMult = 3.0; 
    else if (rank >= 5) rankMult = 5.0;  

    let intMult = 1.0 + (person.int / 400); 
    
    let traitMult = 0;
    person.traits.forEach(t => {
        if (t.name === "天煞孤星") traitMult += 0.25; 
        else if (t.name === "一品金丹") traitMult += 0.22;
        else if (t.name === "天凤血脉" || t.name === "纯阴之体" || t.name === "纯阳之体") traitMult += 0.20;
        else if (t.name === "天生剑心") traitMult += 0.10;
        else if (t.name === "坚韧不拔" || t.name === "手脚麻利") traitMult += 0.05;
        else if (t.type === "bad" && t.name !== "天煞孤星") {
            if (t.name === "经脉堵塞") traitMult -= 0.15;
            else if (t.name === "体弱多病") traitMult -= 0.10;
            else traitMult -= 0.05; 
        }
    });

    let itemBonus = 0;
    if (person.items) {
        person.items.forEach(item => {
            if (item.includes("剑") || item.includes("刀") || item.includes("斧")) itemBonus += 500;
            if (item.includes("宝") || item.includes("印")) itemBonus += 300;
            if (item === "青云剑") itemBonus += 300; 
        });
    }
// ▼▼▼▼▼▼▼▼▼▼ 新增部分开始 ▼▼▼▼▼▼▼▼▼▼
    // 逻辑：只有当计算的对象是“玩家本人”时，才读取具体的装备属性
    // 防止 NPC 蹭到玩家的装备加成
    if (typeof gameState !== 'undefined' && gameState.player && person.id === gameState.player.id) {
        // 检查那个获取BUFF的函数是否存在
        if (window.getEquipmentBuffs) {
            let buffs = window.getEquipmentBuffs(); 
            
            // 核心公式：1点攻击力 = 10点战斗力 (你可以根据需要调整这个倍率)
            if (buffs.attack) {
                itemBonus += (buffs.attack * 10);
            }
            
            // 如果你想把防御力也算进战力，可以取消下面这行的注释
            // if (buffs.defense) itemBonus += (buffs.defense * 10);
        }
    }
    // ▲▲▲▲▲▲▲▲▲▲ 新增部分结束 ▲▲▲▲▲▲▲▲▲▲
    let darkMult = person.isDemonic ? 1.5 : 1.0;
    let total = Math.floor(base * intMult * (1 + traitMult) * darkMult + itemBonus);
    return total;
}

export function getSurname(person) {
    if (!person || !person.name) return "无";
    const nobleSurnames = DB.namePools.surnames.noble;
    const possibleNoble = person.name.substring(0, 2);
    if (nobleSurnames.includes(possibleNoble)) return possibleNoble;
    return person.name.substring(0, 1);
}

export function generateName(gender, inheritedSurname = null, isChild = false) {
    const pools = DB.namePools;
    if (!pools) return "未知";

    let surname = inheritedSurname;
    if (!surname) {
        surname = (Math.random() < 0.2) 
            ? randomChoice(pools.surnames.noble) 
            : randomChoice(pools.surnames.common);
    }

    let name = "";
    const roll = Math.random();
    const gKey = gender === '女' ? 'female' : 'male';
    const pKey = gender === '女' ? 'f' : 'm';

    if (isChild || roll < 0.1) {
        name = randomChoice(pools.nickname.prefix) + randomChoice(pools.nickname['core_' + pKey]);
    } else if (roll < 0.2) {
        name = randomChoice(pools.fate[gKey]);
    } else if (roll < 0.5) {
        name = randomChoice(pools.single[gKey]);
    } else {
        name = randomChoice(pools.twoParts['prefix_' + pKey]) + randomChoice(pools.twoParts['suffix_' + pKey]);
    }

    return surname + name;
}

export function generatePersonality(gender) {
    let pKey = PERSONA_KEYS[Math.floor(Math.random() * PERSONA_KEYS.length)];
    let myPersona = PERSONAS[pKey];
    let dKey = DAO_KEYS[Math.floor(Math.random() * DAO_KEYS.length)];
    let myDao = DAOS[dKey];

    const randRange = (arr) => {
        if (!arr) return 50; 
        return Math.floor(Math.random() * (arr[1] - arr[0] + 1)) + arr[0];
    };
    
    let ranges = myPersona.stats_ranges; 
    let moral = randRange(ranges.moral);
    let devotion = randRange(ranges.devotion);
    let desire = randRange(ranges.desire);

    return {
        key: pKey,            
        name: myPersona.name, 
        desc: myPersona.desc, 
        params: { ...myPersona.params }, 
        isCrazy: myPersona.isCrazy || false, 
        dao: myDao.id,        
        daoName: myDao.name,  
        stats: {              
            moral: moral,     
            devotion: devotion, 
            desire: desire    
        }
    };
}

export function getDisplayTime() {
    let year = Math.ceil(gameState.totalMonths / 12);
    let month = (gameState.totalMonths - 1) % 12 + 1;
    return `修仙第 ${year} 年 ${month} 月`;
}

export function addLog(msg, color="#333") {
    const panel = document.getElementById('gameLog');
    if(panel) {
        const newEntry = `<div class="log-entry" style="color:${color}"><span class="log-time">${getDisplayTime()}</span> ${msg}</div>`;
        panel.insertAdjacentHTML('afterbegin', newEntry);
        while (panel.children.length > 100) {
            if (panel.lastElementChild) {
                panel.removeChild(panel.lastElementChild);
            } else {
                break;
            }
        }
    }
}

export function linkName(person) { return Text.formatName(person); }

export const GeneService = {
    // 【修复2】inheritFeature 现在只负责看父母，绝不自己去碰 DB
    // 这样就避免了用错误的 key 访问 DB 导致的崩溃
    inheritFeature: function(key, father, mother, childGender) {
        // 1. 定义哪些是中性特征（颜色、肤色、气质），可以随便遗传
        const neutralKeys = ['skins', 'hair_colors', 'eye_colors', 'temperaments', 'decorations'];
        
        // 2. 获取父母的值
        let fatherVal = (father && father.appearance) ? father.appearance[key] : null;
        let motherVal = (mother && mother.appearance) ? mother.appearance[key] : null;

        // 3. 判断是否允许遗传
        // 如果是中性特征 -> 父母都能遗传
        // 如果是形状特征（发型、眉毛、眼、鼻、嘴） -> 只能遗传同性别的父母
        let canInheritFather = neutralKeys.includes(key) || (childGender === "男");
        let canInheritMother = neutralKeys.includes(key) || (childGender === "女");

        // 4. 执行遗传逻辑
        // 情况A: 父母都有且都能遗传 -> 混合双打
        if (canInheritFather && fatherVal && canInheritMother && motherVal) {
            let roll = Math.random();
            if (roll < 0.45) return fatherVal;
            if (roll < 0.90) return motherVal;
            return null; // 10% 突变
        }
        
        // 情况B: 只有父亲能遗传 (或者母亲没数据)
        if (canInheritFather && fatherVal) {
            return (Math.random() < 0.5) ? fatherVal : null;
        }

        // 情况C: 只有母亲能遗传 (或者父亲没数据)
        if (canInheritMother && motherVal) {
            return (Math.random() < 0.5) ? motherVal : null;
        }

        return null; // 没父母或没遗传到 -> 返回 null
    },

    // 【修复3】使用 getSafeList 统一管理数据源，彻底解决 keys 名字不匹配的问题
    generateAppearance: function(father, mother, gender = "女", age = 16) {
        // === 方案B 核心修改：幼年不生成外貌 ===
        // 如果年龄小于16岁，直接返回空对象。
        // 因为 ui.js 会直接显示 child_boy.png/child_girl.png，不需要具体数据。
        // 等到16岁成年礼时，logic.js 会再次调用此函数(传入age=16)来生成真正的成年外貌。
        if (age < 16) {
            return { beautyScore: 0 }; 
        }
        // ===================================

        const genes = {};
        // 移除复杂的幼年判断，只处理成年人的逻辑
        const colorKeys = ['skins', 'hair_colors', 'eye_colors', 'temperaments', 'decorations'];
        const shapeKeys = ['eye_shapes', 'eyebrows', 'face_shapes', 'noses', 'lips']; 

        let totalScore = 0;

        // 1. 颜色类 (直接遗传或随机)
        colorKeys.forEach(k => {
            let feature = this.inheritFeature(k, father, mother, gender);
            if (!feature) {
                // getSafeList 会自动处理 _female 后缀
                let list = getSafeList(k, gender); 
                if (list) feature = randomChoice(list);
            }
            if (feature) {
                genes[k] = feature;
                totalScore += (feature.score || 0);
            }
        });

        // 2. 形状类 (直接遗传或随机)
        shapeKeys.forEach(k => {
            let feature = this.inheritFeature(k, father, mother, gender);
            if (!feature) {
                let list = getSafeList(k, gender);
                if (list) feature = randomChoice(list);
            }
            if (feature) {
                genes[k] = feature;
                if (feature.score) totalScore += feature.score;
            }
        });

        // 3. 发型逻辑 (单独处理)
        let hairFeature = this.inheritFeature('hair_styles', father, mother, gender);
        if (!hairFeature) {
            let hairList = getSafeList('hair_styles', gender);
            if (hairList) hairFeature = randomChoice(hairList);
        }
        if (hairFeature) {
            genes.hair_styles = hairFeature; 
            totalScore += (hairFeature.score || 0);
        }

        // 4. 兜底补全 (防止某一项因为数据库缺数据而导致 null)
        const allKeys = [...colorKeys, ...shapeKeys, 'hair_styles'];
        allKeys.forEach(k => {
            if (!genes[k]) {
                genes[k] = { val: "默认", id: "" }; 
            }
        });

        genes.beautyScore = totalScore; 
        return genes;
    },

    generateTraits: function(father, mother) {
        let newTraits = [];
        let inheritPool = [];
        if (father && father.traits) inheritPool = inheritPool.concat(father.traits);
        if (mother && mother.traits) inheritPool = inheritPool.concat(mother.traits);
        
        inheritPool.forEach(t => {
            if (!t) return; // 如果这一项是空的，直接跳过，不执行后面的逻辑
            if (Math.random() < (t.inheritChance || 0.2)) {
                if (!newTraits.some(nt => nt.name === t.name)) {
                    newTraits.push(t);
                }
            }
        });

        if (Math.random() < 0.3) {
            let safePool = DB.traits ? DB.traits.filter(t => t.name !== "天凤血脉") : [];
            let randomTrait = randomChoice(safePool);
            if (randomTrait && !newTraits.some(nt => nt.name === randomTrait.name)) {
                newTraits.push(randomTrait);
            }
        }
        return newTraits;
    },

    getGrowthPotential: function(father, mother) {
        let fInt = father ? father.int : 30;
        let mInt = mother ? mother.int : 30;
        let fCharm = father ? father.charm : 30;
        let mCharm = mother ? mother.charm : 30;

        let intPot = (fInt + mInt) / 200;
        let charmPot = (fCharm + mCharm) / 200;

        intPot *= (0.8 + Math.random() * 0.4);
        charmPot *= (0.8 + Math.random() * 0.4);

        return { 
            int: parseFloat(intPot.toFixed(2)), 
            charm: parseFloat(charmPot.toFixed(2)) 
        };
    }
};
// --- 新增：日志记录器 (Logger) ---
// 是否开启调试模式（发布游戏时改为 false）
const DEBUG_MODE = true; 

export const Logger = {
    // 1. 普通信息 (记录流程，比如：开始生孩子流程)
    info: (module, msg) => {
        if (DEBUG_MODE) console.log(`%c[${module}] ℹ️ ${msg}`, 'color: #3498db');
    },

    // 2. 警告 (数据不对劲，但不影响运行，比如：找不到父亲ID)
    warn: (module, msg, data) => {
        if (DEBUG_MODE) {
            console.warn(`%c[${module}] ⚠️ ${msg}`, 'color: #e67e22');
            if (data) console.warn('相关数据:', data);
        }
    },

    // 3. 错误 (导致崩溃的问题，比如：person 对象是 undefined)
    error: (module, msg, errorObj) => {
        console.error(`%c[${module}] ❌ ${msg}`, 'color: #e74c3c; font-weight: bold; font-size: 12px');
        if (errorObj) console.error(errorObj);
        
        // 尝试弹窗提醒（如果 UI 模块可用）
        if (window.showAlert) window.showAlert(`程序出错了: ${msg}`, "系统错误");
    }
};
window.addLog = addLog;
window.findPerson = (id) => gameState.npcs.find(n => n.id === id); // 顺手把 findPerson 也挂上去，方便测试
window.randomInt = randomInt;
window.randomChoice = randomChoice;

console.log("【系统】Utils.js 已加载，addLog 等工具函数已挂载到 window");

// 判断两人是否有直系或三代内旁系血亲
export function isRelated(p1, p2) {
    if (!p1 || !p2 || p1.id === p2.id) return false;
    
    // 1. 直系与同胞 (父母/子女/兄弟姐妹)
    if (p1.id === p2.fatherId || p1.id === p2.motherId) return true;
    if (p2.id === p1.fatherId || p2.id === p1.motherId) return true;
    if (p1.fatherId && p1.fatherId === p2.fatherId) return true;
    if (p1.motherId && p1.motherId === p2.motherId) return true;

    // 2. 寻找共同祖先 (支持叔伯舅姨、堂表亲、祖孙)
    // 这里的逻辑是：如果两人的父母辈中，有任何一对是兄弟姐妹，则两人是亲戚
    const getParents = (p) => [p.fatherId, p.motherId].filter(id => id);
    const p1Parents = getParents(p1);
    const p2Parents = getParents(p2);

    // 判定祖孙：p1是p2父母的父母
    for (let pId of p2Parents) {
        let parentObj = (window.gameState.npcs || []).find(n => n.id === pId);
        if (parentObj && (parentObj.fatherId === p1.id || parentObj.motherId === p1.id)) return true;
    }
    // 反向祖孙判定
    for (let pId of p1Parents) {
        let parentObj = (window.gameState.npcs || []).find(n => n.id === pId);
        if (parentObj && (parentObj.fatherId === p2.id || parentObj.motherId === p2.id)) return true;
    }

    // 判定叔侄/舅甥：p1的父母 与 p2 是兄弟姐妹 (或者反之)
    // 这里逻辑可以更深，但为了性能，建议目前支持到这里
    return false; 
}
window.isRelated = isRelated;