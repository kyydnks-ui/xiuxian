// config.js
// 全局配置中心：用于管理游戏的平衡性数值
export const G_CONFIG = {
    BLOODLINE: {
        // 第一代初始浓度范围 (极低)
        GEN_1_PURITY_MIN: 1, 
        GEN_1_PURITY_MAX: 5,
        HARVEST_RATE: 0.2,    // 【新增】灵犀回收率。提纯计算时，父亲浓度的 20% 会转化为提纯动力。
        
        // 修炼效率修正 (浓度越高，修得越快)
        // 公式：效率 = BASE + (浓度 * MULT)
        // 1% 浓度 = 0.51倍速 (龟速)
        // 100% 浓度 = 1.5倍速 (天才)
        GROWTH_BASE_RATE: 0.5, 
        GROWTH_PURITY_MULT: 0.01, 

        // 突破成功率修正 (血脉越纯，瓶颈越松)
        BREAKTHROUGH_BONUS: 0.2, // 每 1点浓度 增加 0.2% 成功率
    },
    AGE: {
        ADULT: 16,
        MARRIAGE: 18,
        DEATH_WARN: 5,
    },
    CHANCE: {
        PREGNANCY: 0.15,
        FORCE_PREGNANCY: 0.5, // 强制交互怀孕率 (更高，因为暴力)
        MUTATION: 0.1,
        SOUL_ECHO: 0.05,
        PROPOSAL: 0.25, // 【新增】求婚触发概率 (25%)
        COUPLE_SPAWN: 0.35, // 【新增】初始化或补充人口时，生成夫妻的概率 (35%)
    
        ASSASSINATE: 0.2,   // 刺杀概率
        STOCKHOLM: 0.3,     // 斯德哥尔摩概率
        GENIUS: 0.05,       // 天才概率
        ABORTION_NATURAL: 0.01, // 自然流产
        ABORTION_INDUCE: 0.1,      // 主动堕胎基础概率
        ABORTION_INDUCE_BONUS: 0.1,// 刚烈性格额外概率
        NPC_MOVE: 0.3,          // NPC 搬家概率
   FAVOR_REJECT: -20,      // 拒绝求婚扣好感
        LOVE_REJECT: -5,        // 拒绝求婚扣爱意
        DARK_CRAZY: 30,         // 疯批性格被拒后的黑化值
    
    },
    IMPRISON: {
        // --- 触发囚禁 (checkPlayerCaptured) ---
        TRIGGER_LOVE: 90,             // 触发门槛：爱意值
        TRIGGER_CHANCE: 0.2,          // 触发概率 (20%)
        
        // --- 每日过月 (main.js loop) ---
        DAILY_PREGNANCY_CHANCE: 0.3,  // 强行占有时的怀孕率
        DAILY_DARKNESS_GAIN: 5,       // 每日增加黑化
        DAILY_LOVE_GAIN: 10,          // 每日增加扭曲爱意
        RESCUE_ATTEMPT_CHANCE: 0.3,   // 每月触发劫狱事件的概率

        // --- 劫狱筛选 (handleRescueAttempt) ---
        RESCUE_LOVE_REQ: 90,          // 营救者爱意门槛
        RESCUE_POWER_RATIO: 0.6,      // 营救者战力至少要是监禁者的 60%

        // --- 战斗计算 ---
        BATTLE_BASE_COEFF: 0.5,       // 战力比转化胜率的基础系数
        BATTLE_RNG_MIN: 0.9,          // 随机波动最小值
        BATTLE_RNG_VAR: 0.2,          // 随机波动范围 (+0 ~ 0.2)

        // --- 结局分支判定 ---
        DARK_HERO_THRESHOLD: 60,      // 营救者黑化阈值 (超过则接力)
        DARK_HERO_CHANCE: 0.2,        // 营救者随机黑化概率
        
        // 结局B (接力锁) 惩罚
        CHAIN_DARKNESS: 20,
        CHAIN_LOVE: 50,
        
        // 结局A (获救) 奖励
        SUCCESS_FAVOR: 50,
        SUCCESS_LOVE: 20,

        // 结局C (失败) 惩罚
        FAIL_DEATH_CHANCE: 0.3,       // 营救者战死概率
        FAIL_CAPTOR_DARKNESS: 10      // 监禁者加固黑化
    },
SKILL_DATA: {
        EXP_PER_ACTION: 20,      // 每次动作给 20 经验
        BASE_EXP: 100,           // 基础升级经验
        EXP_MULTIPLIER: 1.5,
        MAX_LEVEL: 10,           // 最高 10 级
        YIELD_STEP: 3,            // 每升 3 级，多产出一个物品
        LUCK_MULT: 2,             // 每级增加 2% 的高品质物品概率
    },
    THRESHOLD: {
        FAVOR_LOVE: 60,    // 表白门槛
        FAVOR_PROPOSE: 60,
        LOVE_PROPOSE: 20,
        MATCH_SCORE_PROPOSE: 90,
        HATE_NEMESIS: -20, // 结仇门槛 (就是你没找到的那个！)
        INT_GENIUS: 80,    // 天才智力门槛
        HATE_ABORTION: -50,        // 触发堕胎的厌恶阈值
        RELATION_RELEVANT: 50,  // 判定为“关系密切”的门槛 (用于显示日志)
        INT_PERFECT: 60,        // 完美筑基智力门槛
        DARK_FAIL_HIGH: 80,     // 严重黑化线 (走火入魔)
        DARK_FAIL_MID: 40,      // 中度黑化线 (心神不宁)
        WOOHOO_MORAL_HIGH: 80,    // 坚守贞洁的道德线
        WOOHOO_LOVE_LOW: 20,      // 拒绝互动的冷淡情谊线
    },
    LIMIT: {
        MAX_FAVOR: 200,    // 好感度上限
        MIN_FAVOR: -200,   // 好感度下限
        MAX_LOVE: 200,     // 爱意上限
   MAX_POPULATION: 24,    // 世界最大人口数
        SPAWN_PER_TURN: 2,     // 每次自动补充的最大人数
    },
    TRIGGER: {
        DARK_FAVOR: -50,   // "市侩"性格黑化线
        DARK_LOVE: 50      // "痴绝"性格黑化线
    },
    RATE: {
        DMG_ABORT_INDUCE: 0.25,   // 主动堕胎伤害率 (25%)
        DMG_ABORT_NATURAL: 0.10,  // 天灾流产伤害率 (10%)
        FAIL_PENALTY_LOW: 0.1,  // 普通失败扣除比例
        FAIL_PENALTY_MID: 0.2,  // 心神不宁扣除比例
        FAIL_PENALTY_HIGH: 0.3, // 走火入魔扣除比例
        TRAVEL_SPEED_BASE: 2,     // 旅途基础修炼速度
        TRAVEL_INT_BONUS: 0.8,    // 旅途智力加成系数
        TRAVEL_RATIO_MIN: 0.5,    // 旅途最低效率 (50%)
        TRAVEL_RATIO_RANGE: 0.3,  // 旅途效率波动范围 (+30%)
        CHARM_VAR_RANGE: 20,      // 魅力随机波动范围
        DEFAULT_BEAUTY: 20,        // 默认颜值分 (兜底用)
        CHARM_BEAUTY_MULT: 1.5,     // 颜值分转魅力倍率 (你代码里的 1.5)
    },
    DAO: {
        STATS_BASE: 100,      // 属性标准化基数 (100)
        
        // 求道者 (Seeker)
        SEEKER_EMOTION: 0.6,  // 对感情的冷淡系数
        
        // 入世者 (Humanist)
        HUMANIST_BENEFIT_BASE: 0.8, // 利益基础系数
        HUMANIST_BENEFIT_S_MULT: 0.5, // 欲望对利益的负修正系数
        
        // 唯我者 (Realist)
        REALIST_RIGHTEOUS: 0.5, // 对道义的无视系数
        REALIST_EMOTION: 0.8    // 对感情的调剂系数
    },
    RANGE: {
        DMG_LIGHT_MIN: 10,
        DMG_LIGHT_MAX: 30,
    },
    DURATION: {
        PREGNANCY_LOG: 3,       // 怀孕第几个月显示显怀提示
        PREGNANCY_FULL: 9,      // 默认怀胎时长
        PREGNANCY_MIN: 7,// 怀胎最小值
        PREGNANCY_MAX: 10,      // 怀胎最大值
        PREGNANCY_INIT: 1,      // 初始进度
        NPC_MOVE_INTERVAL: 3, 
        YEAR_MONTHS: 12,  // NPC 迁移的间隔月数
        UI_DELAY: 100,          // 界面刷新延迟 (毫秒)
    },
    BREAKTHROUGH: {
        BASE_CHANCE: 50,       // 基础成功率
        INT_BONUS: 0.2,        // 智力加成系数
        MAX_CHANCE: 90,        // 最大成功率封顶
        MIN_CHANCE: 5,          // 最低成功率
        // 渡劫/化神专用
        DANGER_BASE: 30,       // 危险关卡基础成功率
        CHANCE_PERFECT: 0.1,    // 完美筑基随机概率
        TRAIT_BONUS_GOLDEN: 20, // 一品金丹加成
        DANGER_INT_BONUS: 0.1, // 危险关卡智力加成
        DARK_PENALTY: 0.5
    },
    REWARD: {
        BREAK_POWER: 500,       // 突破增加修为
        BREAK_INT: 5,           // 突破增加智力
        BREAK_CHARM: 2,         // 突破增加魅力
    },
    MISSION: {
        SECT: {
            BASE_STONES: 50,      // 基础灵石奖励
            INT_MULT_STONES: 1.5, // 智力对灵石的加成系数
            VAR_STONES: 5,        // 灵石随机波动范围
            BASE_CULTIVATION: 5,          // 基础修为奖励
            INT_MULT_CULTIVATION: 0.2     // 智力对修为的加成系数
        }
    },
    MARKET: {
        BASIC_ITEM_COST: 50,     // 基础丹药价格
        BASIC_ITEM_NAME: "聚气丹" // 基础丹药名称
    },
    HUNT: {
        CHANCE_DANGER: 0.3,      // 遭遇危险概率 (30%)
        CHANCE_NORMAL: 0.8,      // 普通收获判定线 (80%-30%=50% 概率)
        
        DMG_BASE: 20,            // 基础修为损失
        DMG_VAR: 20,             // 伤害随机波动
        
        CULTIVATION_NORMAL_BASE: 20,     // 普通收获基础修为
        CULTIVATION_NORMAL_INT_MULT: 1.0,// 普通收获智力加成
        STONES_NORMAL_BASE: 30,   // 普通收获基础灵石
        STONES_NORMAL_VAR: 20,    // 普通收获灵石波动

        LUCK_CHARM_MULT: 0.5,    // 魅力折算运气系数
        LUCK_VAR: 20,            // 运气随机波动
        EXP_BIG_BASE: 200,        // 大机缘基础修为
        EXP_BIG_MULT: 5,         // 运气对大机缘修为的加成
        STONES_BIG_BASE: 150,     // 大机缘基础灵石
        STONES_BIG_VAR: 20,      // 大机缘灵石波动
        
        DEFAULT_STAT: 10         // 属性缺失时的默认值
    },
    // --- 新增：生产配方表 ---
    RECIPES: {
        // === 💊 炼丹配方 ===
        alchemy: [
            {
                id: 'pill_energy',
                name: '聚气丹',
                desc: '基础丹药，精进修为',
                levelReq: 0, // 0级可练
                materials: { "普通药草": 3, "百草液": 1 }, // 消耗材料
                output: { normal: "聚气丹", rare: "极品聚气丹" }, // 产出 (rare是暴击产物)
                baseChance: 0.6, // 基础成功率 60%
                costAP: 1,       // 消耗精力
                exp: 15          // 获得经验
            },
            {
                id: 'pill_beauty',
                name: '驻颜丹',
                desc: '青春永驻，提升魅力',
                levelReq: 3, // 3级可练
                materials: { "千年灵芝": 1, "天青花": 2, "百草液": 2 },
                output: { normal: "驻颜丹", rare: "极品驻颜丹" },
                baseChance: 0.4,
                costAP: 2,
                exp: 30
            },
            {
                id: 'pill_baby',
                name: '多子丸',
                desc: '求子心切者的福音',
                levelReq: 5,
                materials: { "妖兽精血": 2, "千年灵芝": 1 },
                output: { normal: "多子丸", rare: "麒麟送子丹" },
                baseChance: 0.3,
                costAP: 3,
                exp: 50
            }
        ],
        // === 🔨 炼器配方 ===
   // === 🔨 炼器配方 (V0.80 属性增强版) ===
        forging: [
            {
                id: 'weapon_iron',
                name: '精铁剑',
                desc: '凡铁百炼，削铁如泥',
                levelReq: 0,
                materials: { "铁矿": 5, "碎石": 2 },
                // buff: 装备属性定义
                output: { 
                    normal: "精铁剑", 
                    normalBuff: { attack: 5 }, // 攻击+5
                    rare: "百炼钢剑",
                    rareBuff: { attack: 15, hunting_rate: 0.1 } // 攻击+15, 狩猎成功率+10%
                },
                baseChance: 0.7,
                costAP: 1,
                exp: 20
            },
            {
                id: 'armor_scale',
                name: '鳞甲',
                desc: '以妖兽鳞片编织的护甲',
                levelReq: 3,
                materials: { "厚重的兽皮": 2, "精铜": 3 },
                output: { 
                    normal: "鳞甲", 
                    normalBuff: { defense: 5 }, // 减伤+5
                    rare: "玄龟宝甲",
                    rareBuff: { defense: 20, max_hp: 50 } // 减伤+20, 假设以后有血量系统
                },
                baseChance: 0.5,
                costAP: 3,
                exp: 40
            },
             {
                id: 'weapon_gold',
                name: '金蛇剑',
                desc: '庚金之气所化，无坚不摧',
                levelReq: 6,
                materials: { "玄铁精金": 1, "庚金": 2, "高阶妖丹": 1 },
                output: { 
                    normal: "金蛇剑", 
                    normalBuff: { attack: 50, hunting_rate: 0.2 }, 
                    rare: "斩龙神剑", // <--- 只有这个级别能诞生器灵
                    rareBuff: { attack: 100, hunting_rate: 0.5, speed: 0.2 }, // 攻击+100, 狩猎+50%, 修炼速度+20%
                    hasSpirit: true // 标记：可诞生器灵
                },
                baseChance: 0.3,
                costAP: 5,
                exp: 80
            }
        ]
    },
    SOUL_ECHO: {
        MIN_RELATION_LIMIT: 80,   // 触发感应的最低关系门槛 (绝对值)
        BASE_CHANCE: 5,           // 基础成功概率 (%)
        INT_BONUS_MULT: 0.2,      // 智力加成系数
        HIGH_LOVE_LINE: 100,      // 极深爱意判定线
        HIGH_HATE_LINE: -100,     // 极深恨意判定线
        BONUS_LOVE: 20,           // 极深爱意提供的概率加成
        BONUS_HATE: 30,           // 极深恨意提供的概率加成
        BONUS_OBSESSIVE: 30,      // “痴绝”性格提供的加成 (直觉怪物)
        ACTIVE_FAVOR_LINE: 50,    // 玩家主动撩拨触发加成的门槛
        BONUS_ACTIVE: 10,         // 主动撩拨提供的概率加成
        MAX_CHANCE_LIMIT: 80,      // 概率最终锁顶值 (不让它 100% 发生)
    BONUS_ADMIT_LOVE: 100,    // 承认身份后的爱意加成
        BONUS_ADMIT_FAVOR: 100,   // 承认身份后的好感加成
        PENALTY_ADMIT_DARK: 20,   // 承认身份后的黑化值增加 (背德感)
        PENALTY_ADMIT_HATE: -100, // 仇人相认的好感跌落
        BONUS_DENY_LOVE: 20       // 否认身份后的爱意补偿 (替身文学)  
    },
    REALM: {
        SUPPRESS_GAP: 2,        // 境界超过 2 层开始压制好感
        BREAK_CHANCE_MULT: 0.001, // 魅力/智力破开压制的概率系数
        COLD_FAVOR_LINE: 10     // 高冷NPC的基础好感门槛
    },
    EMOTION: {
        LOG_THRESHOLD: 2,       // 骨相修正差异超过 2 点才显示上帝日志
        MAX_LOVE: 200,          // 爱意上限
        MIN_LOVE: 0             // 爱意下限
    },
    MATCH: {
        LOVE_WEIGHT: 2.0,        // 爱意对得分的权重系数 (爱比好感值钱)
        CHARM_GAP_WEIGHT: 0.5,   // 魅力差距的加成系数
        
        // 实力压制
        POWER_WIN_BASE: 20,      // 实力高于对方的基础加成
        POWER_WIN_PRIDE_EXTRA: 20, // 对方是“骄阳”性格时，崇拜强者的额外加成 (20+20=40)
        POWER_LOSS_PENALTY: 10,  // 实力低于对方的扣分
        
        // 年龄限制
        AGE_GAP_THRESHOLD: 20,   // 触发老少恋嫌弃的岁数差
        AGE_GAP_PENALTY: 15      // 跨代恋的扣分
    },
    GROWTH: {
        ADULT_AGE: 18,            // 属性定型年龄
        DEFAULT_POTENTIAL: 0.3    // 默认成长潜力
    },
    CULTIVATION: {
        PLAYER_BASE_SPEED: 2,     // 玩家基础修炼速度
        INT_WEIGHT: 0.8,          // 智商贡献权重
        NPC_EFFICIENCY_MAP: [1.0, 1.0, 0.8, 0.5, 0.3, 0.1], // NPC各境界效率
        NPC_AVERAGE_DILIGENCE: 0.7, // NPC平均勤奋度
        MIN_GAIN: 1,              // 修炼保底收益
        AP_RATIO_HIGH: 1.0,       // 闭关精力线
        AP_RATIO_MED: 0.3         // 日常精力线
    },
    CALAMITY: {
        DEMON_MIN_POWER: 1000,    // 触发心魔的最低修为
        DEMON_BASE_RISK: 0.001,   // 基础风险值
        DEMON_RISK_DIVISOR: 10000000, // 风险随修为增长的稀释率
        DEMON_MAX_RISK: 0.01,     // 最大风险上限
        DARKNESS_PUNISH: 100,     // 正派入魔黑化增加值
        POWER_LOSS_PERCENT: 0.5,  // 散修入魔修为损失比例
        RECOVERY_CHANCE: 0.1,     // 入魔者清醒概率 (10%)
        RECOVERY_POWER_RATE: 0.5, // 觉醒后修为暴涨比例
        RECOVERY_POWER_FLAT: 500, // 觉醒后修为固定加成
        RECOVERY_STAT_BONUS: 20,  // 觉醒后属性大补值 (智力/魅力)
        DEMONIC_IDLE_LOG: 0.3,  // 入魔者胡言乱语的日志概率
        SOLO_STAR_GAIN: 5,        // 天煞孤星每回合修为加成
        SOLO_STAR_CHANCE: 0.1,    // 克扣亲友的概率
        SOLO_STAR_VICTIM_LOSS: 50 // 亲友损失的修为
    },
    LIFE: {
        DEFAULT_BASE: 80,         // 凡人基础寿命上限
        FACTOR_MIN: 0.9,          // 天命系数最小值
        FACTOR_RANGE: 0.25,       // 天命系数随机范围 (0.9 ~ 1.15)
        PHOENIX_CURSE_DIV: 2,      // 天凤血脉诅咒导致的寿命缩减倍率 (减半)
        PURITY_CURSE_MULT: 0.02,   // 【新增】每 1% 浓度额外增加的寿命缩减系数
        WARN_INTERVAL_MONTHS: 12  // 预警频率 (每12个月提醒一次)
    },
    SOCIAL: {
        ACTIVE_EVENT_RATE: 0.4,   // 每月发生社交事件的总人口比例 (40%)
        INDIVIDUAL_ACT_CHANCE: 0.3,// 每个NPC主动搞事的概率 (30%)
        DIVORCE_THRESHOLD: -20,   // 触发离婚的好感度门槛
        MIN_ACTIVE_NPCS: 2        // 触发互动所需的最小NPC人数
    },
    ACTIONS: {
        TALK: {
            COST: 1,                // 消耗精力
            FAVOR_BASE_MIN: 6,      // 基础好感随机最小值
            FAVOR_BASE_MAX: 8,      // 基础好感随机最大值
            
            // 动情判定
            LOVE_TRIGGER_FAVOR: 30, // 触发动情的最低好感门槛
            CHANCE_LOVE_HIGH: 0.2,  // 怦然心动概率 (20%)
            CHANCE_LOVE_MID: 0.7,   // 感情升温判定线 (70%-20%=50%)
            LOVE_GAIN_HIGH: 15,     // 怦然心动固定加成
            
            // 地图解锁 (Reveal Map)
            REVEAL_FAVOR_LIMIT: 60, // 必解锁的好感门槛
            REVEAL_LOVE_LIMIT: 30,  // 必解锁的爱情门槛
            
            CHANCE_CHARM_REVEAL: 50,// 魅力吸引解锁概率 (50%)
            PLAYER_CHARM_MIN: 8,    // 触发魅力解锁的玩家魅力值
            NPC_FAVOR_MIN: 10,      // 触发魅力解锁的NPC好感值
            
            CHANCE_NORMAL_REVEAL: 10 // 普通闲聊解锁概率 (10%)
        },
        GIFT: {
            COST: 1,                // 消耗精力
            
            // 价值定义
            VAL_HIGH: 100,          // 贵重物品判定线
            VAL_LOW: 10,            // 廉价物品判定线
            VAL_DEFAULT: 10,        // 默认价值
            VAL_CHEAP: 5,           // 极低价值（瓜果）

            // 收益基准
            GAIN_BASE: 15,          // 基础好感加成
            GAIN_EMPTY: 5,          // 没东西送（送瓜果）的保底加成
            
            // 性格修正
            BONUS_MARKET_HIGH: 40,  // 市侩：收到贵重礼物的收益 (暴击)
            PENALTY_MARKET_LOW: -5, // 市侩：收到廉价礼物的惩罚 (厌恶)
            GAIN_PURE_HEART: 20,    // 守心：君子之交的固定收益
            BONUS_OBSESSED: 10,     // 痴绝：额外的情感加成
            BONUS_NORMAL_HIGH: 10,  // 普通人：贵重礼物的额外加成
            
            // 欲望侵蚀
            DESIRE_EROSION: 2       // 送贵重物品增加的欲望点数
        },
       
        ASSASSINATE: {
            COUNTER_DMG_MIN: 10,   // 反击伤害最小值
            COUNTER_DMG_MAX: 30,   // 反击伤害最大值
            
            HIT_DMG_MIN: 20,       // 玩家中招伤害最小值
            HIT_DMG_MAX: 50        // 玩家中招伤害最大值
        },
        STEAL: {
            COST: 2,                 // 消耗精力
            BASE_DARKNESS_GAIN: 10,  // 失败后增加的黑化值 (坏名声)
            
            // 成功率加成系数 (如果以后你想让某种特质增加偷窃率)
            INT_THRESHOLD_OFFSET: 0, 

            // 失败后果：性格修正
            FAVOR_LOSS_NORMAL: -20,  // 普通性格好感扣除
            FAVOR_LOSS_MARKET: -60,  // 市侩性格 (视财如命) 惩罚
            FAVOR_LOSS_ARROGANT: -10, // 疏狂性格 (不拘小节) 惩罚
            FAVOR_LOSS_NOBLE: -40,   // 清贵性格 (清高鄙夷) 惩罚
    },
    KILL: {
        COST: 0, // 杀人通常不耗精力
            BASE_DARKNESS_GAIN: 50,  // 处决一个凡人/修士增加的黑化值
            NEMESIS_EXTRA_DARK: 20,  // 处决宿敌（虽然解恨）但杀念更重的额外黑化
            SOULMATE_PENALTY: 100    // 【狗血警告】处决自己的灵魂伴侣/道侣，黑化值直接拉满
        },
    KIDNAP: {
            COST: 1,
            // 基础惩罚
            FAVOR_LOSS_NORMAL: -100,
            DARKNESS_GAIN_NORMAL: 50,
            
            // 痴绝性格 (病态)
            FAVOR_LOSS_OBSESSED: -50,
            DARKNESS_GAIN_OBSESSED: 20,
            LOVE_GAIN_OBSESSED: 20,
            
            // 清贵性格 (尊严)
            FAVOR_LOSS_NOBLE: -200,
            DARKNESS_GAIN_NOBLE: 80
        },

        RELEASE: {
            COST: 0,
            OBSESSED_DARK_GAIN: 30,  // 痴绝者被放走产生的绝望(黑化)
            NEMESIS_DARK_LIMIT: 80,  // 触发反目成仇的黑化阈值
            
            // 斯德哥尔摩效应
            STOCKHOLM_CHARM_REQ: 80, // 触发所需的玩家魅力
            STOCKHOLM_CHANCE: 0.3,   // 触发概率
            STOCKHOLM_FAVOR: 60,     // 扭曲的好感设定
            STOCKHOLM_LOVE: 50,      // 扭曲的爱意设定
            STOCKHOLM_DARK: 90,      // 扭曲的黑化设定
            
            // 正义释放奖励
            RIGHTEOUS_FAVOR: 20      // 正常释放加的正义感好感
        },
        CONFISCATE: {
            COST: 1,
            // 反应数值化
            MARKET: { DARK: 30, FAVOR: -50 },  // 市侩
            NOBLE:  { DARK: 40, FAVOR: -80 },  // 清贵
            OBSESSED: { LOVE: 5 },             // 痴绝
            LONELY: { FAVOR: -20 },            // 孤绝
            ARROGANT: { FAVOR: -10 },          // 疏狂
            PURE: { MORAL: -1 },               // 守心
            SUNNY: { FAVOR: -30 }              // 骄阳
    },
    MARRY: {
            COST: 2,
            
            // 基础门槛 (通用型)
            BASE_FAVOR_REQ: 60,
            BASE_LOVE_REQ: 30,

            // 性格差异化门槛
            NOBLE: { FAVOR: 80, LOVE: 60, POWER_RATE: 0.8 }, // 清贵：高冷且看修为
            MARKET: { FAVOR: 90, LOVE: 10 },               // 市侩：只要好感(钱)到位，爱不爱的无所谓
            OBSESSED: { FAVOR: 20, LOVE: 10 },             // 痴绝：只要是你，倒贴也行

            // 成功后的情感红利
            MARRIAGE_BONUS: 20,                            // 结为道侣后的情感飞跃
            REJECT_FAVOR_LOSS: -5                          // 被拒后的尴尬扣分
        },
        PERSUADE: {
            COST: 2,                 // 劝说动作消耗的基础精力
            SACRIFICE_POWER_RATE: 0.1, // 苦肉计损耗自身修为的比例 (预留给后续 handlePersuasion 使用)
            SUCCESS_BASE_CHANCE: 30,  // 基础成功概率 (预留)
        },
        BOND_RESOLVE: { // 补上这个动作的配置
            COST: 3,
            THRESHOLD_DEFAULT: 80,
            THRESHOLD_EASY: 60,
            THRESHOLD_HARD: 85,
            FAVOR_GAIN: 40,
            LOVE_GAIN: 20
        },
       FORCE_BABY: {
            COST: 3,
            // 基础惩罚
            NORMAL_FAVOR_LOSS: -30,
            NORMAL_DARK_GAIN: 30,
            // 痴绝
            OBSESSED_FAVOR_LOSS: -10,
            OBSESSED_LOVE_GAIN: 10,
            OBSESSED_DARK_GAIN: 50,
            // 清贵/守心
            NOBLE_FAVOR_LOSS: -100,
            NOBLE_DARK_GAIN: 60
        },

        BABY: {
            COST: 3,
            SPOUSE_RESISTANCE_REDUCE: 200, // 夫妻阻力大减
            DEEP_LOVE_LIMIT: 80,           // 深爱判定线
            DEEP_LOVE_RESISTANCE_REDUCE: 50, // 深爱减阻力
            
            SUCCESS_FAVOR_GAIN: 10,
            SUCCESS_LOVE_GAIN: 5,
            MORAL_DECAY_LINE: 60,          // 触发道德沦丧的门槛
            MORAL_DECAY_VALUE: 1,          // 每次掉的道德
            DESIRE_GROW_VALUE: 1,          // 每次加的欲望
            
            REFUSE_FAVOR_LOSS: -2          // 猴急扣的好感
        },
        DIVORCE: {
            COST: 2,
            // 协议离婚判定门槛
            REFUSE_DEVOTION_LIMIT: 80, // 重情重义线
            REFUSE_LOVE_LIMIT: 90,     // 执念深重线
            
            // 失败惩罚
            REFUSE_DARK_BASE: 20,      // 拒离基础黑化
            REFUSE_DARK_VAR: 10,       // 拒离随机黑化波动
            
            // 成功后果
            SUCCESS_FAVOR: -20,        // 协议离婚后的基础好感 (陌生人)
            SUCCESS_DARK_OBSESSED: 20, // 痴绝/市侩性格离婚后的黑化

            // 【强制休弃】
            FORCE_FAVOR_LOSS: -150,    // 强制基础扣分
            FORCE_DARK_GAIN: 50,       // 强制基础黑化
            
            // 性格极端修正
            OBSESSED_DARK: 100,        // 痴绝：疯魔黑化值
            OBSESSED_FAVOR: -200,      // 痴绝：好感跌停
            NOBLE_FAVOR: -200,         // 清贵：奇耻大辱扣分
            DEVOTION_EXTRA_DARK: 20    // 高情义者额外黑化
        },
        DISCUSS_DAO: {
            COST: 0,                // 论道消耗精力
            DEVOTION_BONUS: 1.2,    // 改变情义值的智力加成系数
            INT_ROLL_MIN: 0.8,      // 智力骰子最小值
            INT_ROLL_RANGE: 0.4,    // 智力骰子波动范围
            
            CHANGE_BASE_MIN: 4,     // 属性变动基础最小值
            CHANGE_BASE_MAX: 8,     // 属性变动基础最大值
            
            // 额外好感奖励
            FAVOR_GIVE_BOND: 5,     // 执行“感化”时的额外好感
            FAVOR_SEEKER_BONUS: 3,  // 对“求道者”论道的额外好感
            
            // 失败惩罚
            FAIL_FAVOR_NORMAL: -2,  // 普通失败扣除好感
            FAIL_FAVOR_REALIST: -5  // 唯我者失败扣除更多 (反感被说教)
        },
        FORCE_CHARM: {
            COST: 3,
            // 成功后果
            FAVOR_LOSS_NORMAL: -50,
            DARKNESS_GAIN_NORMAL: 30,
            OBSESSED_LOVE_GAIN: 20,
            
            // 失败后果
            FAIL_FAVOR_LOSS: -20,
            FAIL_POWER_PENALTY: 10
        }
    },
    DAO_MODIFIER: {
        REALIST_DEFENSE: 1.5,       // 唯我者抵御点化/苦行的加成
        OBSESSED_DEFENSE: 2.0,      // 痴绝者抵御离间的加成 (恋爱脑之魂)
        PURE_HEART_DEFENSE: 1.3     // 守心者抵御蛊惑的加成
    },
    BATTLE: {
        COST_AP: 2,               // 消耗精力
        INT_BONUS_MULT: 0.005,    // 智力对战力的加成系数
        REALIST_BURST: 1.1,       // 唯我者生死关头的爆发倍率
        
        // 随机波动范围
        ROLL_MIN: 0.8,            // 最小波动 (80%)
        ROLL_RANGE: 0.4,          // 波动范围 (80% + 40% = 120%)

        // 胜负后果
        WIN_DAMAGE_RATE: 0.3,     // 胜利后对目标造成的修为损耗比例
        WIN_CULTIVATION_GAIN: 5,          // 玩家获胜的经验加成
        LOSS_POWER_PENALTY: 20,  // 玩家战败的生命损耗
        LOSS_ROB_RATE: 0.2,       // 唯我者战胜玩家时的打劫比例

        // 情感变动 (配置化)
        FAVOR_WIN_LOSS: -20,      // 战败基础扣除好感
        FAVOR_REALIST_SUBMIT: -5, // 唯我者求饶时的好感变动
        FAVOR_SEEKER_RESPECT: 5,  // 求道者战败时的尊敬加成
        LOVE_HUMANIST_TWISTED: 5, // 入世者受虐时的扭曲爱意
        FAVOR_HUMANIST_MERCY: 2,  // 入世者获胜放人加的好感
        FAVOR_SEEKER_DISAPPOINT: -5, // 求道者获胜后的失望扣分
        FAVOR_REALIST_DISDAIN: -10   // 唯我者获胜后的鄙夷扣分
    },
    WORLD_GEN: {
        // 初始 Roll 点范围
        PLAYER_ROLL: {
            POWER: [10, 50],
            INT: [20, 70],
            CHARM: [50, 95]
        },
        // 性格权重
        PERSONALITY_WEIGHTS: { GOOD: 35, NEUTRAL: 40, EVIL: 25 },
        PARENT_INFLUENCE_BONUS: 0.3, // 父母性格对孩子的言传身教加成

        // 路人刷新权重 (基于玩家境界 [凡人, 炼气, 筑基, 金丹, 元婴, 化神])
        NPC_RANK_WEIGHTS: {
            RANK_0: [850, 140, 6, 3, 1, 0],   // 玩家凡人
            RANK_1: [400, 400, 170, 18, 12, 0], // 玩家炼气
            RANK_2: [100, 200, 500, 170, 30, 0], // 玩家筑基
            RANK_3: [10, 90, 300, 500, 100, 0],  // 玩家金丹
            GOD_LIKE: [0, 10, 100, 300, 500, 90] // 元婴及以上
        },

        GENIUS_CHANCE: 0.05,        // 天才(低龄高能)概率
        FIRST_SIGHT_BASE: 0.01,     // 一见钟情基础概率
        FIRST_SIGHT_CHARM_MULT: 0.0005, // 玩家魅力对一见钟情的加成系数
        FIRST_SIGHT_TRAIT_BONUS: 0.2    // 桃花泛滥特质加成
    },
    INHERIT: {
        SURNAME_POWER_RATIO: 1.2,   // 姓氏继承的实力压制阈值 (1.2倍)
        TRAIT_GOD_CHANCE: 0.5,      // 神级特质继承率
        CHILD_INT_CHARM: [1, 5]     // 亲生婴儿初始属性
    },
    R18_CONFIG: {
        // 身体部位定义
        BODY_PARTS: {
            scalp: "头发",
            ears: "耳朵",
            nape: "后颈",
            adam_apple: "喉结",
            collarbone: "锁骨",
            nipples: "乳头",
            waist: "腰侧",
            navel: "肚脐",
            glans: "龟头",
            corona: "冠状沟",
            frenulum: "系带",
            shaft: "茎身",
            scrotum: "阴囊",
            perineum: "会阴",
            cloaca: "泄殖腔",
            prostate: "前列腺",
            buttocks: "臀部",
            inner_thighs: "大腿内侧",
            back_of_knees: "膝盖后侧",
            ankles: "脚踝",
            soles: "脚底",
            toes: "脚趾"
        },
        PRIMAL_YANG_BONUS_POWER: 500, // 夺走元阳获得的修为
        PRIMAL_YANG_BONUS_LOVE: 50    // 夺走元阳增加的爱意
    }
};
// --- 勒索与囚禁系统配置 ---
G_CONFIG.BLACKMAIL = {
    MONEY_DEMAND: 500,          // 勒索灵石数
    PREGNANCY_CHANCE: 0.2,      // 肉偿受孕率
    CHARM_THRESHOLD: 80,        // 触发“食髓知味”的魅力门槛
    LOVE_GAIN: 50,              // 沉沦后增加的爱意
    DARKNESS_GAIN: 30,          // 沉沦后增加的黑化
    HP_PENALTY: 30,             // 劫狱失败扣除的生命值
    SUCCESS_COEFF: {
        RELATION: 0.4,          // 亲友关系权重
        INTEL: 0.2,             // 玩家智力权重
        POWER: 10               // 修为压制权重
    }
}
const SKILL_CONFIG = {
    MAX_LEVEL: 10,
    INHERIT_RATE: 0.5, // 夺舍后的保留比例
    LEARN_COOLDOWN: 1, // 每月请教次数限制
    SKILLS: {
        GATHERING: { id: 'gathering', name: '采集', threshold: 0, sect: null },
        ALCHEMY: { id: 'alchemy', name: '炼丹', threshold: 100, sect: '丹鼎阁' },
        ARTIFACT: { id: 'artifact', name: '炼器', threshold: 100, sect: '万剑山' },
        HEHE_ART: { id: 'hehe_art', name: '合心秘术', threshold: 100, sect: '合欢宗' }
    },
    TEACH: {
        RELATION_LIMIT: 100,      // 好感度门槛
        BASE_GAIN: 20,           // 基础进度增长
        INT_BONUS_MULT: 0.5,     // 智力对学习的加成系数
        HEHUAN_BONUS: 2.0        // 合欢宗双修学习倍率
    }
};
