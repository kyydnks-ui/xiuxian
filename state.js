// state.js
// 负责定义游戏的核心数据结构
// ----------------------------------------------------------------

export let gameState = {
    player: null,
    skills: {
        gathering: { level: 0, exp: 0 },
        hunting:   { level: 0, exp: 0 }, // 新增：独立狩猎技能
        alchemy:   { level: 0, exp: 0 },
        artifact:  { level: 0, exp: 0 },
        hehe_art:  { level: 0, exp: 0 }
        },
    children: [], 
    npcs: [],      
    spouseId: null,
    // --- v0.28 新增：精力系统 ---

    unlockedLocations: ["sect", "market", "wild"],
    // ---------------------------

    totalMonths: 1, 
    selectedPersonId: null,
    isPlayerImprisoned: false,
    captorId: null, // 【新增】记录当前囚禁玩家的 NPC ID
    // --- v0.58 新增：大山探索状态 ---
    wildStatus: {
        direction: 'center', // 当前方位：'north', 'south', 'east', 'west', 'center'
        depth: 0            // 当前深度：0:表层, 1:中层, 2:深层, 3:核心
    },
    monthlyLearned: false,
    // --- 游戏设置 ---
    settings: {
        showGossip: true,   // 显示八卦
        showBattle: true,   // 显示战斗
        showBirth: true,    // 显示生子
        enableR18: false, // [新增] 默认为关闭状态
        // --- 新增音频设置 ---
        enableBGM: true,    // 默认开启背景音乐
        enableSFX: true,     // 默认开启音效
        // 【新增】音量设置 (0.0 - 1.0)
        bgmVolume: 0.4,  // 默认 BGM 音量
        sfxVolume: 0.6   // 默认音效音量
    }
};

// 【新增】把数据挂载到 window 上，方便控制台调试
window.gameState = gameState;

export let tempRollStats = { power: 10, int: 10, charm: 10 };

// [state.js] 追加在文件末尾
export function findPerson(id) {
    if (!id) return null;
    if (gameState.player && id === gameState.player.id) return gameState.player;
    if (gameState.children) {
        const child = gameState.children.find(c => c.id === id);
        if (child) return child;
    }
    // 主要是找 NPC
    return gameState.npcs.find(n => n.id === id);
}