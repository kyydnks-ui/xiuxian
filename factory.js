// factory.js
// 角色生成工厂 (v0.28.6 动态生态版)
// ----------------------------------------------------------------
import { DB, REALMS, PERSONAS, PERSONA_KEYS, DAOS, DAO_KEYS, PERSONA_CATEGORIES, MALE_GENITAL_LIB, CHEST_LIB } from './data.js'; // <--- 必须导入 REALMS
import { gameState } from './state.js';
import { Text } from './text.js';
// 必须导入 getRealmRank
import { randomInt, randomChoice, getRealmName, GeneService, generateName, getSurname, getRealmRank } from './utils.js';
import { getRandomLocation } from './locations.js';// <--- 新增
import { G_CONFIG } from './config.js';
export function generateRollStats() {
    const cfg = G_CONFIG.WORLD_GEN.PLAYER_ROLL;
    let biasedRandom = Math.max(Math.random(), Math.random());
    let intVal = Math.floor(cfg.INT[0] + biasedRandom * (cfg.INT[1] - cfg.INT[0] + 1));

    return { 
        power: randomInt(cfg.POWER[0], cfg.POWER[1]), 
        int: intVal, 
        charm: randomInt(cfg.CHARM[0], cfg.CHARM[1]) 
    };
}

// --- 新增：复杂性格生成器 (含阵营权重) ---
// parentsType: { father: 'GOOD', mother: 'EVIL' } (可选，用于子嗣成年判定)
export function generatePersonality(gender, parentsType = null) {
    // 1. 计算三大阵营的权重
    // 默认权重: 善35%, 中40%, 恶25%
    let weights = {
        GOOD: PERSONA_CATEGORIES.GOOD.weight,
        NEUTRAL: PERSONA_CATEGORIES.NEUTRAL.weight,
        EVIL: PERSONA_CATEGORIES.EVIL.weight
    };

    // 如果有父母影响 (言传身教)，大幅增加对应阵营的权重
    if (parentsType) {
        // 比如：父母每有一方是"恶"，"恶"的权重就 +0.3
        const BONUS = 0.3;
        if (parentsType.father) weights[parentsType.father] += BONUS;
        if (parentsType.mother) weights[parentsType.mother] += BONUS;
    }

    // 2. 权重轮盘算法选择阵营
    let totalWeight = weights.GOOD + weights.NEUTRAL + weights.EVIL;
    let random = Math.random() * totalWeight;
    
    let selectedCategory = 'NEUTRAL'; // 兜底
    if (random < weights.GOOD) selectedCategory = 'GOOD';
    else if (random < weights.GOOD + weights.NEUTRAL) selectedCategory = 'NEUTRAL';
    else selectedCategory = 'EVIL';

    // 3. 从选中阵营中，随机抽取一个具体性格 (如从"善"中抽取"骄阳")
    let keys = PERSONA_CATEGORIES[selectedCategory].keys;
    let pKey = keys[Math.floor(Math.random() * keys.length)];
    let myPersona = PERSONAS[pKey];

    // 4. 随机抽取骨相 (Dao) - 保持原有逻辑
    let dKey = DAO_KEYS[Math.floor(Math.random() * DAO_KEYS.length)];
    let myDao = DAOS[dKey];

    // 5. 根据皮囊生成三轴数值
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
        stats: { moral, devotion, desire },
        // 记录一下所属阵营，方便下次遗传
        category: selectedCategory 
    };
}

export function createPerson(isPlayer = false, father = null, mother = null, customGenes = null, fixedGender = null) {
    // 1. 生成基础性别与姓名
    let gender = "女"; // 默认值

    // 【修改点】优先检查是否有强制指定的性别
    if (fixedGender) {
        gender = fixedGender; 
    } 
    // 如果是玩家，强制女
    else if (isPlayer) {
        gender = "女";
    } 
    // 如果有父亲（是生孩子），50%概率
    else if (father) {
        gender = Math.random() > 0.5 ? "女" : "男"; 
    } 
    // 纯路人，随机（原本设定的概率）
    else {
        gender = Math.random() > 0.6 ? "女" : "男"; 
    }

    // 强制姓氏继承逻辑
    let inheritedSurname = null;
   // 情况A：父母双全
    if (father && mother) {
        // 1. 玩家特权：只要有一方是玩家，默认优先给个“云”姓（或其他玩家姓）
        // (注：如果是私生子被拒的剧情，logic.js 会在后续把名字改掉，所以这里初始给云姓没问题)
        if (father.id === gameState.player.id || mother.id === gameState.player.id) {
             inheritedSurname = "云"; 
        }
        // 2. NPC 父母：修仙界实力为尊
        else {
            let fPower = father.power || 0;
            let mPower = mother.power || 0;
            // 设定一个差距阈值 (比如强 20%)
            let ratio = 1.2;

            if (mPower > fPower * ratio) {
                // 母亲比父亲强 20% 以上 -> 随母姓 (入赘/母系强势)
                inheritedSurname = getSurname(mother);
            } else if (fPower > mPower * ratio) {
                // 父亲比母亲强 20% 以上 -> 随父姓
                inheritedSurname = getSurname(father);
            } else {
                // 势均力敌 -> 50% 概率随机
                inheritedSurname = Math.random() > 0.5 ? getSurname(father) : getSurname(mother);
            }
        }
    }
    // 情况B：只有父亲 (特殊单亲)
    else if (father) {
        inheritedSurname = getSurname(father);
    }
    // 情况C：只有母亲 (特殊单亲)
    else if (mother) {
        inheritedSurname = getSurname(mother);
    }

    let personName = isPlayer ? "云雾衡" : generateName(gender, inheritedSurname, !!father);
    // ============================================
    // v0.28.6 核心修改：动态计算年龄与修为
    // ============================================
    let age = 18;
    let power = 0;
    
    // --- 修改后的核心逻辑：增加配置优先判断 ---
    // 这里的 isFixedCheck 用于判断是否有来自 FIXED_WORLD_CONFIG 的预设
    // 注意：在你的 createPerson 参数定义中，第四个参数是 customGenes，
    // 我们约定如果是固定 NPC，这个参数会携带 data.js 里的配置对象。
    
    if (father) {
        // A. 如果是生孩子：0岁，0修为
        age = 0;
        power = 0;
    } else if (customGenes && customGenes.power !== undefined) {
        // B. 【新增】固定 NPC 逻辑：如果配置里有 power，直接使用配置
        power = customGenes.power;
        age = customGenes.age || 18; // 如果没写年龄，默认18
    } else if (!isPlayer) {
        // C. 如果是随机路人：执行原有的动态生成逻辑
        let pRank = gameState.player ? getRealmRank(gameState.player.power) : 0;
        let weights = [];
        const wCfg = G_CONFIG.WORLD_GEN.NPC_RANK_WEIGHTS;
        if (pRank === 0) weights = wCfg.RANK_0;
        else if (pRank === 1) weights = wCfg.RANK_1;
        else if (pRank === 2) weights = wCfg.RANK_2;
        else if (pRank === 3) weights = wCfg.RANK_3;
        else weights = wCfg.GOD_LIKE;

        let targetRank = weightedRandom(weights); 
        const subRealmRanges = [[0, 0], [1, 10], [11, 14], [15, 18], [19, 22], [23, 26]];
        let range = subRealmRanges[targetRank]; 
        let targetSubIdx = randomInt(range[0], range[1]);
        
        let minPower = REALMS[targetSubIdx].min;
        let nextRealm = REALMS[targetSubIdx + 1];
        let maxPower = nextRealm ? nextRealm.min : minPower * 2;
        
        power = randomInt(minPower, maxPower - 1);

        let adultAge = G_CONFIG.AGE.ADULT;
        let minAgeBase = adultAge + (targetRank * 20); 
        let maxAgeBase = 60 + (targetRank * 50);
        
        if (Math.random() < G_CONFIG.WORLD_GEN.GENIUS_CHANCE) {
            age = randomInt(adultAge, minAgeBase); 
        } else {
            age = randomInt(minAgeBase, maxAgeBase); 
        }
    } else {
        // D. 如果是玩家初始化
        age = 16;
        power = 0;
    }
   // ============================================
    // 3. 性格生成
    // ============================================
    let pType;
    if (isPlayer) {
        // ★ 玩家专属：固定一个“万金油”性格
        pType = {
            key: "PLAYER",
            name: "深藏不露", 
            desc: "命运虚无缥缈，你只信自己。",
            params: { favorRate: 1.0, loveRate: 1.0, darkBase: 0, darkTrigger: 100 }, 
            isCrazy: false,
            dao: "self",
            daoName: "本我",
            stats: { moral: 50, devotion: 50, desire: 50 } // 中庸数值
        };
    } else {
        if (father && age < 16) {
            let childP = PERSONAS.CHILD;
            pType = {
                key: "CHILD",
                name: childP.name,
                desc: childP.desc,
                params: { ...childP.params },
                isCrazy: false,
                dao: "humanist", // 孩子默认比较纯真
                daoName: "入世者",
                stats: { moral:50, devotion:50, desire:50 },
                category: "NEUTRAL"
            };
        } else {
            // ★ NPC：随机生成 (8皮囊+3骨相)
            pType = generatePersonality(gender);
        }
    }

    // ============================================
    // 4. 定义身份池 & 核心数值 (魅力与血脉)
    // ============================================
    const sectPool = [
        "sect", "he_huan", "wan_jian", "dan_ding", // 四大宗门
        "shen_family", "mo_family",               // 两大世家 (新增)
        null, null                                // 散修 (null, 增加权重)
    ];

    // A. 魅力值 (Charm) - 完全独立，不再依赖立绘
    let finalCharm = 0;
    if (isPlayer) {
        // 玩家的魅力在 initGame 时由 Roll 点决定，这里给个保底即可
        finalCharm = randomInt(10, 50); 
    } else {
        // NPC 随机魅力：正态分布模拟 (大部分人长相普通，极少数天仙)
        let roll = Math.random();
        if (roll < 0.1) finalCharm = randomInt(10, 30);       // 丑
        else if (roll < 0.7) finalCharm = randomInt(31, 70);  // 普通/清秀
        else if (roll < 0.95) finalCharm = randomInt(71, 90); // 美人
        else finalCharm = randomInt(91, 100);                 // 绝世
    }

    // B. 血脉浓度 (Bloodline Purity)
    let purity = 0;

    if (isPlayer) {
        // 【第一代】：始祖诅咒，浓度极低 (1-5)
        if (!gameState.generation || gameState.generation === 1) {
            const cfg = G_CONFIG.BLOODLINE;
            purity = randomInt(cfg.GEN_1_PURITY_MIN, cfg.GEN_1_PURITY_MAX);
        } else {
            purity = 5; // 兜底
        }
    } 
    else if (father && mother) {
        // 【天凤提纯逻辑】：母亲血脉为主，强行吸收父亲的灵犀
        let fP = father.bloodlinePurity || 0; // 父亲的灵犀
        let mP = mother.bloodlinePurity || 0; // 母亲的天凤血脉
        
        // 计算公式：基础浓度 = 母亲浓度 + (父亲灵犀 * 回收率)
        const cfg = G_CONFIG.BLOODLINE;
        let base = mP + (fP * cfg.HARVEST_RATE);
        
        // 继承波动 (0.9 ~ 1.1)
        let mutation = randomInt(90, 110) / 100; 
        
        // 返祖爆种 (2% 几率大幅提升)
        if (Math.random() < 0.02) mutation = 1.3;

        purity = Math.floor(base * mutation);
        // 限制最高 100
        if (purity > 100) purity = 100;
    }
    else {
        // 【野生 NPC】：神血激发 (Latent Activation)
        let roll = Math.random();
        
        if (roll < 0.9) purity = 0;
        else if (roll < 0.99) purity = randomInt(1, 10);
        else purity = randomInt(20, 50);
        
        // 世家子弟保底
        // 这里需要先随机出 homeSect 才能判断，所以我们先暂存逻辑，等下赋值 homeSect 后再修正
    }

    // ============================================
    // 5. 组装对象
    // ============================================
    
    // 先确定户籍，以便修正血脉
    let homeSect = sectPool[Math.floor(Math.random() * sectPool.length)];
    if (isPlayer) {
        homeSect = 'sect';
    }
    
    // 修正世家血脉逻辑
    if (!isPlayer && !father && ["shen_family", "mo_family"].includes(homeSect)) {
        purity = Math.max(purity, randomInt(5, 15));
    }

    let person = {
        id: Date.now() + Math.random(),
        name: personName,
        gender: gender,
        age: age,    
        power: power, 
        charm: finalCharm, 
        int: randomInt(10, 80),
        bloodlinePurity: purity,
        personality: pType, 
        traits: [], 
        appearance: {}, 
        appearanceDesc: "",
        favor: 0,    
        love: 0,
        ap: 3,      // 当前精力
        maxAP: 3,     // 精力上限
        darkness: pType.params.darkBase + randomInt(0, 5),
        pregnancyProgress: 0,
        childParentId: null,
        birthTarget: 0,
        isSpouse: false,
        isImprisoned: false,
        isIllegitimate: false,
        isNemesis: false, 
        isStockholm: false,
        relationships: {}, 
        items: [randomChoice(DB.items).name],
       bodyStats: (function() {
            let stats = {};
            const parts = [
                "scalp", "ears", "nape", "adam_apple", "collarbone", "nipples", 
                "waist", "navel", "glans", "corona", "frenulum", "shaft", 
                "scrotum", "perineum", "cloaca", "prostate", "buttocks", 
                "inner_thighs", "back_of_knees", "ankles", "soles", "toes"
            ];
            parts.forEach(key => stats[key] = 0);
            return stats;
        })(),
genital: gender === '男' ? {
            size: randomChoice(MALE_GENITAL_LIB.size),
            hardness: randomChoice(MALE_GENITAL_LIB.hardness),
            glans: {
                shape: randomChoice(MALE_GENITAL_LIB.glans.shape),
                color: randomChoice(MALE_GENITAL_LIB.glans.color),
                feature: randomChoice(MALE_GENITAL_LIB.glans.feature)
            },
            shaft: randomChoice(MALE_GENITAL_LIB.shaft),
            scrotum: randomChoice(MALE_GENITAL_LIB.scrotum),
            fluid: randomChoice(MALE_GENITAL_LIB.fluid)
        } : null,
        chest: {
            type: randomChoice(CHEST_LIB.type),
            muscle: randomChoice(CHEST_LIB.muscle),
            skin: randomChoice(CHEST_LIB.skin),
            nipple: randomChoice(CHEST_LIB.nipple),
            hair: randomChoice(CHEST_LIB.hair)
        },
        // 2. 元阳/元阴设定 (依据新规则 v2)
        hasPrimalYang: (function() {
            // 女性没有元阳
            if (gender !== "男") return false;
            
            // 规则1: 未成年 (<16岁) -> 都有
            if (age < 16) return true;

            // 规则2: 成年 + 归属地为合欢宗 + 单身 (创建时默认都是单身)
            // 只有 40% 概率有元阳
            if (homeSect === 'he_huan') {
                return Math.random() < 0.4;
            }

            // 规则3: 成年 + 其他门派 + 单身 -> 都有 (100%)
            return true;
        })(),
        // =======================
        fatherId: father ? father.id : null,
        motherId: mother ? mother.id : null, 
        prevRealmName: "凡人",
        skills: {
            gathering: isPlayer ? 0 : (randomInt(1, 5)), 
            alchemy: isPlayer ? 0 : (power > 15000 ? randomInt(5, 10) : randomInt(0, 3)),
            artifact: isPlayer ? 0 : (power > 15000 ? randomInt(5, 10) : randomInt(0, 3)),
            hehe_art: isPlayer ? 0 : (power > 15000 ? randomInt(3, 8) : randomInt(0, 2))
        },
        hasTaughtThisMonth: false, // 标记该 NPC 本月是否已教过人
        location: getRandomLocation(),
        homeSect: homeSect,
        history: [] 
    };

    // --- 【核心修复点：外貌锁定】 ---
    if (customGenes) {
        person.appearance = customGenes; 
    } else {
        person.appearance = GeneService.generateAppearance(father, mother, person.gender, person.age);
    }
    
    // 生成外貌描述
    person.appearanceDesc = Text.getAppearanceDesc(person);

    // ============================================
    // 6. 特质与属性修正
    // ============================================
    if (isPlayer) {
        person.traits.push({ 
            name: "天凤血脉", 
            grade: 5, 
            type: "god", 
            inheritChance: 0.5, 
            buff: { power: 15, charm: 10 } 
        });
        person.items = ["驻颜丹"]; 
        person.charm = Math.max(80, person.charm); 
    } else {
        person.traits = GeneService.generateTraits(father, mother);
        
        let rank = getRealmRank(person.power);
        
        // 2. 只有路人(非玩家、非亲生孩子)才应用“筛选漏斗”
        if (!isPlayer && !father) {
            // 根据境界决定智商范围
            let minInt = 10, maxInt = 60; // 默认凡人
            
            if (rank === 1) { minInt = 15; maxInt = 80; }      // 炼气
            else if (rank === 2) { minInt = 35; maxInt = 90; } // 筑基 (筛选开始)
            else if (rank === 3) { minInt = 55; maxInt = 95; } // 金丹 (精英)
            else if (rank >= 4) { minInt = 75; maxInt = 110; } // 元婴+ (老怪)

            // 5% 概率出现“傻人有傻福”的武痴
            if (Math.random() < 0.05) {
                minInt = 10;
            }

            person.int = randomInt(minInt, maxInt);
        }

        // 天才修正
        let expectedMinAge = 16 + (rank * 20);
        if (!father && person.age < expectedMinAge) {
             person.int = Math.max(person.int, randomInt(80, 100)); // 天才智力高
             person.charm = Math.max(person.charm, randomInt(70, 90)); // 天才颜值高
        }

        // 一见钟情判定
        if (gameState.player && person.age >= 18 && !isPlayer && person.gender === "男") {
            const fCfg = G_CONFIG.WORLD_GEN;
            let loveChance = fCfg.FIRST_SIGHT_BASE + (gameState.player.charm * fCfg.FIRST_SIGHT_CHARM_MULT);
            if(person.traits.some(t => t.name === "桃花泛滥")) loveChance += fCfg.FIRST_SIGHT_TRAIT_BONUS;
            
            if (Math.random() < loveChance) {
                person.favor = 50; 
                person.love = 30;
                person.isLoveAtFirstSight = true;
            }
        }
    }
    
    // 7. 优生优育：计算并写入成长潜力
    person.potential = GeneService.getGrowthPotential(father, mother);
    
    // 婴儿初始化修正
    if (father) {
        person.int = randomInt(1, 5);
        person.charm = randomInt(1, 5);
        person.power = 0;
    }
    
    // 应用特质加成
    person.traits.forEach(t => {
        if(t.buff.power) person.power += t.buff.power;
        if(t.buff.charm) person.charm += t.buff.charm;
        if(t.buff.int) person.int += t.buff.int;
    });

    // 8. 逻辑清洗
    if (getRealmRank(person.power) < 2) {
        person.traits = person.traits.filter(t => t.name !== "天道筑基");
    }
    if (getRealmRank(person.power) < 3) {
        person.traits = person.traits.filter(t => t.name !== "一品金丹");
    }

    person.prevRealmName = getRealmName(person.power);
    return person;
}

// --- 辅助函数：权重随机 ---
// 放在文件最底下即可
function weightedRandom(weights) {
    let total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        if (random < weights[i]) return i;
        random -= weights[i];
    }
    return 0;
}
/**
 * 根据战力获取 NPC 的身份头衔
 * @param {Object} person NPC对象
 * @returns {String} 头衔名称
 */
export function getNPCRankName(person) {
    if (!person || person.power === undefined) return "凡人";
    const power = person.power;
    // 根据你代码里的境界划分，这里设定地位阈值
    if (power >= 40000) return "宗主"; 
    if (power >= 15000) return "内门长老";
    if (power >= 5000)  return "精英弟子";
    if (power >= 500)   return "外门弟子";
    return "杂役";
}
window.createPerson = createPerson;
window.generatePersonality = generatePersonality;
window.getNPCRankName = getNPCRankName;
window.REALMS = REALMS;

console.log("【系统】Factory.js 已加载，createPerson 已挂载到 window");