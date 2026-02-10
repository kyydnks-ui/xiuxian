// locations.js (v0.35 更新：增加隐世宗门)

export const LOCATIONS = {
    // === 初始可见区域 ===
    "sect": { 
        id: "sect",
        name: "青云宗", 
        desc: "云雾缭绕的仙家福地，乃是你修行的大本营。", 
        type: "safe",
        hidden: false // 初始可见
    },
    "market": { 
        id: "market",
        name: "云海坊市", 
        desc: "散修聚集交易之地，鱼龙混杂，消息灵通。", 
        type: "neutral",
        hidden: false
    },
    "wild": { 
        id: "wild",
        name: "十万大山", 
        desc: "妖兽横行，杀人夺宝的法外之地，危机四伏。", 
        type: "danger",
        hidden: false
    },

    // === 需要探索解锁的宗门 ===
    "he_huan": { 
        id: "he_huan",
        name: "合欢宗", 
        desc: "门下弟子皆俊男美女，修行双修之法，行事亦正亦邪。", 
        type: "neutral",
        hidden: true // 初始隐藏
    },
    "wan_jian": { 
        id: "wan_jian",
        name: "万剑门", 
        desc: "天下剑修圣地，门风严谨，嫉恶如仇。", 
        type: "safe",
        hidden: true
    },
    "dan_ding": { 
        id: "dan_ding",
        name: "丹鼎阁", 
        desc: "炼丹圣地，富可敌国，无数修士求药于此。", 
        type: "neutral",
        hidden: true
    },
    "shen_family": { 
        id: "shen_family", 
        name: "沈氏封地", 
        desc: "沈光行所统辖的领地，规矩森严，族中女子地位极高。", 
        type: "safe", 
        hidden: false 
    },
    "mo_family": { 
        id: "mo_family", 
        name: "莫氏山庄", 
        desc: "莫家的祖宅，草药芬芳，与云家曾有世交之情。", 
        type: "safe", 
        hidden: false 
    }
};

// 定义路程耗时
const TRAVEL_COSTS = {
    // === 基础路线 ===
    "sect-market": 1, "market-sect": 1,   // 宗门 <-> 坊市 (很近)
    "market-wild": 2, "wild-market": 2,   // 坊市 <-> 大山
    "sect-wild": 3,   "wild-sect": 3,     // 宗门 <-> 大山 (较远)
    
    // === 世家路线 (新增) ===
    // 莫家是世交，设定离青云宗比较近
    "sect-mo_family": 1, "mo_family-sect": 1, 
    "market-mo_family": 1, "mo_family-market": 1,

    // 沈家是封地，设定稍微远一点，或者靠近坊市
    "sect-shen_family": 2, "shen_family-sect": 2,
    "market-shen_family": 1, "shen_family-market": 1,

    // === 隐世宗门 (路途遥远) ===
    "market-he_huan": 3, "he_huan-market": 3,
    "market-wan_jian": 4, "wan_jian-market": 4, // 万剑山很远
    "market-dan_ding": 2, "dan_ding-market": 2
};

export function getTravelTime(fromId, toId) {
    if (fromId === toId) return 0;
    const key = `${fromId}-${toId}`;
    return TRAVEL_COSTS[key] || 4; // 默认4个月
}

export function getRandomLocation() {
    const keys = Object.keys(LOCATIONS);
    return keys[Math.floor(Math.random() * keys.length)];
}

export function getLocationName(id) {
    return LOCATIONS[id] ? LOCATIONS[id].name : "未知之地";
}