// audio.js
// 音频管理模块 (修复版：包含音量控制)
// ----------------------------------------------------------------
import { gameState } from './state.js';

// 1. 定义音频文件路径
const AUDIO_FILES = {
    bgm: 'assets/bgm.mp3',      // 背景音乐
    click: 'assets/click.mp3',  // 点击音效
    hover: 'assets/hover.mp3',  // 悬停音效
    popup: 'assets/popup.mp3'   // 弹窗音效
};

// 2. 创建音频对象
const audioContext = {
    bgm: new Audio(AUDIO_FILES.bgm),
    click: new Audio(AUDIO_FILES.click),
    hover: new Audio(AUDIO_FILES.hover),
    popup: new Audio(AUDIO_FILES.popup)
};

// 3. 初始化设置
audioContext.bgm.loop = true;  // BGM 循环播放
// 注意：音量现在由 setBGMVolume 动态控制，不再这里写死

// 防抖变量 (防止悬停音效触发太快)
let lastHoverTime = 0;

// --- 核心功能 ---

// 【新增】设置 BGM 音量
export function setBGMVolume(val) {
    // 确保值在 0 到 1 之间
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    audioContext.bgm.volume = v;
}

// 【新增】设置音效音量
export function setSFXVolume(val) {
    const v = Math.max(0, Math.min(1, parseFloat(val)));
    
    // 分别设置各个音效
    if(audioContext.click) audioContext.click.volume = v;
    if(audioContext.popup) audioContext.popup.volume = v;
    
    // hover 音效通常比较频繁，建议比其他音效稍小一点 (例如 50% 比例)
    if(audioContext.hover) audioContext.hover.volume = v * 0.5; 
}

// 播放 BGM
export function playBGM() {
    if (gameState.settings.enableBGM) {
        // 如果没在播放，才开始播
        if (audioContext.bgm.paused) {
            audioContext.bgm.play().catch(e => {
                console.log("等待用户点击以播放音乐...");
            });
        }
    }
}

// 停止 BGM
export function stopBGM() {
    audioContext.bgm.pause();
}

// 播放音效 (通用函数)
export function playSound(key) {
    if (!gameState.settings.enableSFX) return;
    
    // 特殊处理：悬停音效加冷却时间 (100毫秒内只响一次)
    if (key === 'hover') {
        const now = Date.now();
        if (now - lastHoverTime < 100) return; 
        lastHoverTime = now;
    }

    const sound = audioContext[key];
    if (sound) {
        sound.currentTime = 0; // 每次播放前重置进度，支持快速连点
        sound.play().catch(e => {});
    }
}

// 切换 BGM 开关
export function toggleBGM(isEnabled) {
    gameState.settings.enableBGM = isEnabled;
    if (isEnabled) playBGM();
    else stopBGM();
}

// 切换 音效 开关
export function toggleSFX(isEnabled) {
    gameState.settings.enableSFX = isEnabled;
}
// --- 挂载到全局，供 HTML 按钮调用 ---
window.playSound = playSound;
// 为了保险，把其他几个也挂上去
if (typeof playBGM !== 'undefined') window.playBGM = playBGM;
if (typeof clickSound !== 'undefined') window.clickSound = clickSound;
if (typeof hoverSound !== 'undefined') window.hoverSound = hoverSound;

console.log("【音频】playSound 已挂载到 window");