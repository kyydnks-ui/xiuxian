// ui.js
// 负责界面渲染与DOM操作
// ----------------------------------------------------------------
import { gameState, findPerson } from './state.js';
import { History } from './history.js'; // <--- 新增
import { getLocationName,LOCATIONS, getTravelTime } from './locations.js'; // <--- 新增这一行
import { DB, REALMS } from './data.js';
import { Text } from './text.js';
import { getRealmName, getCombatPower, getRealmRank } from './utils.js';
import { toggleBGM, toggleSFX, playSound, setBGMVolume, setSFXVolume } from './audio.js'; // 引入音频模块
import { seizeBody } from './logic.js';
import { G_CONFIG } from './config.js';
import { getNPCRankName } from './factory.js';
window.globalZIndex = 10000;
// 专门用来关闭这种动态生成的弹窗
window.closeModalElement = function(element) {
    if (element) {
        // 找到这一层弹窗并移除
        let overlay = element.closest('.modal-overlay');
        if (overlay) overlay.remove();
        window.playSound('click'); 
    }
};
// 辅助工具：生成带音效的按钮 HTML (v0.28 修正版)
function btnHtml(text, onClick, colorClass="btn-inv", style="", disabled=false) {
    // 1. 如果禁用：添加 disabled 属性，变半透明，鼠标变禁止符号，变黑白
    //    如果不禁用：正常应用 style
    let disabledAttr = disabled ? 'disabled style="opacity:0.5; cursor:not-allowed; filter:grayscale(100%); ' + style + '"' : `style="${style}"`;
    
    // 2. 如果禁用：不绑定任何鼠标事件（不响，不触发逻辑）
    //    如果不禁用：绑定音效和点击事件
    let interaction = disabled ? '' : `onmouseover="window.playSound('hover')" onclick="window.playSound('click'); ${onClick}"`;
    
    // 3. 组合 HTML
    return `<button class="btn ${colorClass}" ${disabledAttr} ${interaction}>${text}</button>`;
}

// --- 主界面更新 ---
export function updateUI() {
    const p = gameState.player;
    if (!p) { console.error("玩家数据未初始化！"); return; }
    // === 【修复】同步囚犯位置 ===
    // 强制把所有被囚禁的NPC拉到玩家当前位置，防止玩家移动后囚犯消失
    if (gameState.npcs) {
        gameState.npcs.forEach(n => {
            if (n.isImprisoned) n.location = p.location;
        });
    }
    // ===========================
    const isLocked = gameState.isPlayerImprisoned;
    // --- 1. 禁锢/囚禁状态拦截 (视觉与逻辑) ---
    const mapEl = document.getElementById('map-container');
    if (mapEl) {
        // 坐牢时地图变灰、模糊、禁止点击
        mapEl.style.pointerEvents = isLocked ? 'none' : 'auto';
        mapEl.style.filter = isLocked ? 'grayscale(1) blur(2px)' : 'none';
        mapEl.style.transition = "all 0.5s ease";
    }

    if (isLocked) {
        const captor = gameState.npcs.find(n => n.id === gameState.captorId);
        const locNameEl = document.getElementById('current-location-name');
        if (locNameEl) {
            locNameEl.innerHTML = `<span style="color:#c0392b; font-weight:bold; animation: pulse 2s infinite;">⛓️ 禁锢之地 (被 ${captor ? captor.name : '神秘人'} 囚禁)</span>`;
        }
    }
// === 新增：死亡状态拦截 ===
    // 如果玩家已死（且未成功夺舍），界面变灰，禁用按钮
    if (p.isDead) {
        document.body.style.filter = "grayscale(100%)";
        // 可以在这里把所有按钮 disable 掉，或者显示一个遮罩
        // 但由于我们有 handlePlayerDeath 弹窗，这里只要视觉反馈即可
    } else {
        document.body.style.filter = "none";
    }
    // ========================
    document.getElementById('pName').innerText = p.name;
    // ▼▼▼ 新增：把生成的头像塞进刚才挖的坑里 ▼▼▼
    let playerAvatar = getAvatarHtml(p, 100); // 生成 70px 大小的头像
    let avatarContainer = document.getElementById('pAvatarDisplay');
    if (avatarContainer) avatarContainer.innerHTML = playerAvatar;
    // ▲▲▲ 新增结束 ▲▲▲
    //document.getElementById('pAgeDisplay').innerText = p.age + "岁"; 
    // 新代码：显示 "当前 / 上限"
    // 如果 logic.js 里计算了 p._maxLife，就用它；否则先给个问号，下一回合会自动刷新
    let maxLifeDisplay = p._maxLife || "??";
    let ageHtml = `${p.age} <span style="font-size:12px; color:#999;">/ ${maxLifeDisplay}岁</span>`;
    document.getElementById('pAgeDisplay').innerHTML = ageHtml; // 注意这里是 innerHTML
    document.getElementById('gameTime').innerText = `修仙第 ${Math.ceil(gameState.totalMonths / 12)} 年 ${ (gameState.totalMonths - 1) % 12 + 1 } 月`;
    document.getElementById('pPower').innerText = p.power;
    document.getElementById('pInt').innerText = p.int;
    document.getElementById('pCharm').innerText = p.charm;
    
    document.getElementById('pRealm').innerText = getRealmName(p.power);
    document.getElementById('pAP').innerText = `${p.ap || 0} / ${p.maxAP || 3}`;

    let spouse = gameState.npcs.find(n => n.id === gameState.spouseId);
    document.getElementById('pSpouse').innerText = spouse ? spouse.name : "无";

    // 子嗣列表 (加音效)
    let childHtml = gameState.children
        .filter(c => !c.isDead) // <--- 加上这一行，把死掉的孩子藏起来
        .map(c => 
            `<span class="child-token ${c.gender === '女' ? 'girl' : 'boy'}" 
                   onmouseover="window.playSound('hover')"
                   onclick="window.playSound('click'); window.openDetail(${c.id})">
                ${c.name} (${c.age}岁) 
                ${c.traits.some(t=>t.name==='天凤血脉') ? '🔥' : ''}
            </span>`
        ).join('');
    
    document.getElementById('childrenList').innerHTML = childHtml || '<span style="color:#999;font-size:12px">暂无子嗣</span>';

    const list = document.getElementById('npcList');
if (list) {
    list.innerHTML = "";

    // --- 1. 基础过滤：排除死人，获取同地NPC ---
    let nearby = gameState.npcs.filter(npc => !npc.isDead && npc.location === p.location);

    // --- 2. 【核心拦截】病娇囚禁禁制 ---
    if (gameState.isPlayerImprisoned) {
        // 如果被囚禁，列表强制过滤到只剩“囚禁者”一人
        nearby = nearby.filter(n => n.id === gameState.captorId);
        
        // 兜底：如果囚禁者刚好不在这个地图（比如刚过月刷新），强行把他拉过来大眼瞪小眼
        if (nearby.length === 0) {
            const captor = gameState.npcs.find(n => n.id === gameState.captorId);
            if (captor) {
                captor.location = p.location; 
                nearby = [captor];
            }
        }
    }

    // --- 3. 遍历渲染 (注意：这里现在使用的是 nearby 数组) ---
    nearby.forEach(npc => {
        if (!npc.appearanceDesc) npc.appearanceDesc = Text.getAppearanceDesc(npc);
        
        // 标签处理
        let tagsHtml = npc.traits.map(t => {
            let colorClass = "neutral";
            if(t.grade >= 4) colorClass = "god";
            else if(t.grade >= 2) colorClass = "good";
            else if(t.grade === 0) colorClass = "bad";
            return `<span class="tag ${colorClass}" title="${t.desc}" style="cursor:help;">${t.name}</span>`;
        }).join('');

        let cardClass = npc.gender === '男' ? 'male' : 'female'; // 修正：优先根据您的互动偏好显示
        if (npc.isImprisoned) cardClass += ' imprisoned'; 
        if (npc.isDemonic) cardClass += ' demonic';

        let badges = "";
        
        // --- 情感与关系标记 ---
        if (npc.id === gameState.captorId && gameState.isPlayerImprisoned) {
            badges += `<span class="status-badge" style="background:#c0392b; color:white;">禁锢者</span>`;
        } else if (npc.isSpouse) {
            let spouseTitle = npc.gender === '男' ? '夫君' : '爱妻';
            badges += `<span class="status-badge badge-spouse">${spouseTitle}</span>`;
        } else if (npc.spouseId) {
            badges += `<span class="status-badge" style="background:#7f8c8d; color:white;">已婚</span>`;
        }

        if (npc.fatherId === p.id || npc.motherId === p.id) {
            badges += `<span class="status-badge" style="background:#9b59b6; color:white;">子女</span>`;
        }

        // 状态标记
        if (npc.isPregnant) badges += `<span class="status-badge badge-preg">孕</span>`;
        if (npc.isNemesis) badges += `<span class="status-badge badge-nemesis">仇</span>`;
        if (npc.love > 90) badges += `<span class="status-badge" style="background:#ff4757; color:white;">痴</span>`;

        let card = document.createElement('div');
        card.className = `npc-card ${cardClass}`;
        card.onmouseover = () => window.playSound('hover');
        card.onclick = () => { window.playSound('click'); window.openDetail(npc.id); };
        
        let realmName = getRealmName(npc.power);
        let sectDisplay = npc.homeSect 
            ? ` <span style="color:#3498db; font-weight:bold;">| ${getLocationName(npc.homeSect)}</span>`
            : ` <span style="color:#95a5a6;">| 散修</span>`;

        let avatarHtml = getAvatarHtml(npc, 90);

        card.innerHTML = `
            ${badges}
            <div style="display:flex; align-items:center;">
                ${avatarHtml} 
                <div style="margin-left:10px;">
                    <div class="npc-name">${npc.name}
                        <span class="personality-label" style="font-weight:normal; opacity:0.8;">${npc.personality.name}</span>
                    </div>
                    <div style="font-size:12px; margin:5px 0;">${npc.age}岁 | ${realmName}${sectDisplay}</div>
                    <div>${tagsHtml}</div>
                </div>
            </div>`;
        list.appendChild(card);
    });
}
    // --- v0.28.1 动态注入“突破”按钮 (新增代码) ---
    
    // 1. 检查玩家是否处于瓶颈期
    let isStuck = false;
    // 遍历找当前境界
    for (let i = REALMS.length - 1; i >= 0; i--) {
        if (p.power >= REALMS[i].min) {
            // 如果是瓶颈境界(如炼气圆满)，且修为已经到了下一阶的门槛
            if (REALMS[i].isBottleneck && p.power >= REALMS[i].min) {
                isStuck = true;
            }
            break;
        }
    }

    // 2. 找到 UI 上的操作栏
    let sectionTitle = document.querySelector('.section-title');
    if (sectionTitle) {
        // 构造“下一回合”按钮 (始终存在)
        // 注意：这里我们保留原来的蓝色按钮样式
        let nextBtn = `<button class="btn" style="background:#3498db; color:white;" onmouseover="window.playSound('hover')" onclick="window.playSound('click'); window.nextTurn()">🌙 闭关一月</button>`;
        
       // 构造“突破”按钮 (仅瓶颈期显示)
        let breakBtn = "";
        if (isStuck) {
            // 这是一个闪烁的红色按钮
            breakBtn = `<button class="btn" style="background:#c0392b; color:white; margin-right:10px; animation:pulse 1s infinite;" onmouseover="window.playSound('hover')" onclick="window.clickBreakthrough()">⚡ 尝试突破</button>`;
        }

        // 重新渲染这块区域：标题 + 按钮组
        // ▼▼▼ 新增：获取当前地名 ▼▼▼
        let locName = getLocationName(p.location);

        // --- 动态生成外出按钮 ---
let travelBtn = "";
if (gameState.isPlayerImprisoned) {
    // 囚禁状态：渲染灰色锁定按钮
    travelBtn = `<button class="btn" style="background:#7f8c8d; color:#bdc3c7; cursor:not-allowed;" disabled>🔒 禁锢中无法外出</button>`;
} else {
    // 正常状态：渲染绿色外出按钮
    travelBtn = `<button class="btn" style="background:#27ae60; color:white; margin-right:5px;" onmouseover="window.playSound('hover')" onclick="window.playSound('click'); window.openMap()">🌏 外出历练</button>`;
}

// ▼▼▼ 新增：闭关按钮逻辑 ▼▼▼
let secludeBtn = `<button class="btn" style="background:#8e44ad; color:white; margin-right:5px;" onmouseover="window.playSound('hover')" onclick="window.playSound('click'); window.openSeclusionInput()">🧘 闭关</button>`;

// ★★★ 关键点：这一行赋值必须在 if/else 之外，确保囚禁时也能刷新 UI 内容 ★★★
sectionTitle.innerHTML = `<span>📍 [${locName}] 当前场景</span> <div>${travelBtn} ${secludeBtn} ${breakBtn} ${nextBtn}</div>`;

        // 我们把它插在 sectionTitle (标题栏) 的后面
        let sceneContainer = document.getElementById('scene-action-area');
        if (!sceneContainer) {
            sceneContainer = document.createElement('div');
            sceneContainer.id = 'scene-action-area';
            sectionTitle.after(sceneContainer); // 插入到标题栏之后
        }

        // 2. 准备数据 (直接使用已有的 p 变量，不要重新 let p)
        let stones = p.spiritStones || 0;
        let actionHtml = "";

        // 3. 根据地点生成不同的按钮
        if (p.location === "sect") {
            // 宗门
            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#f0f8ff; border:1px solid #bdc3c7; border-radius:5px;">
                    <div style="font-weight:bold; color:#2980b9; margin-bottom:5px;">🏔️ 青云宗 - 事务堂</div>
                    <div style="font-size:12px; color:#555; margin-bottom:8px;">当前灵石: <span style="color:#e67e22; font-weight:bold;">${stones}</span></div>
                    <button class="btn" style="background:#3498db; color:white; width:100%;" onclick="window.handleSectMission()">
                        📜 领取宗门杂务 (+灵石 +少量修为)
                    </button>
                </div>`;
        } else if (p.location === "market") {
            // --- 🏮 坊市 (重构版) ---
            
            // 1. 定义商品列表 (直接读取 DB，或者手动指定热销品)
            // 这里我们手动列出要卖的东西，方便控制
            const goods = [
                "聚气丹", "受孕丹", "多子丸", "迷情香", "驻颜丹", "合欢散"
            ];

            // 2. 生成商品按钮 HTML
            let goodsHtml = goods.map(name => {
                let item = DB.items.find(i => i.name === name);
                if (!item) return "";
                let price = item.price || 9999;
                
                // 检查买不买得起，买不起就变灰
                let canBuy = (p.spiritStones || 0) >= price;
                let btnStyle = canBuy ? "background:#e67e22; color:white;" : "background:#ccc; color:#666; cursor:not-allowed;";
                
                // 如果买不起，就不绑定点击事件 (或者绑定一个提示)
                let clickAction = canBuy ? `window.buyItem('${name}', ${price})` : `window.showAlert('灵石不足！')`;

                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:white; margin-bottom:6px; padding:6px 10px; border-radius:4px; border:1px dashed #eee;">
                        <div style="flex:1;">
                            <div style="font-weight:bold; font-size:13px; color:#d35400;">${name}</div>
                            <div style="font-size:10px; color:#888;">${item.desc}</div>
                        </div>
                        <button class="btn" style="font-size:12px; padding:4px 8px; ${btnStyle} min-width:60px;" 
                            onclick="${clickAction}">
                            💰 ${price}
                        </button>
                    </div>
                `;
            }).join('');

            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#fff8f0; border:1px solid #e67e22; border-radius:5px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #fce8cc; padding-bottom:5px;">
                        <span style="font-weight:bold; color:#d35400;">🏮 聚宝阁</span>
                        <span style="font-size:12px; color:#555;">余额: <span style="color:#e67e22; font-weight:bold;">${stones}</span> 灵石</span>
                    </div>
                    
                    <div style="max-height: 180px; overflow-y: auto;">
                        ${goodsHtml}
                    </div>
                </div>`;
        }else if (p.location === "dan_ding" || p.location === "danding") {
            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#fff3e0; border:1px solid #e67e22; border-radius:5px;">
                    <div style="font-weight:bold; color:#d35400; margin-bottom:5px;">🔥 丹鼎阁 - 地火房</div>
                    <div style="font-size:12px; color:#555; margin-bottom:8px;">
                        借地火之力，炼制天地灵丹。<br>
                        当前炼丹术: Lv.${(p.skills.alchemy ? p.skills.alchemy.level : 0)}
                    </div>
                    <button class="btn" style="background:#d35400; color:white; width:100%;" 
                        onclick="window.openCraftingMenu('alchemy')">
                        💊 开炉炼丹
                    </button>
                </div>`;
        }
        
        // ▼▼▼ 新增：万剑山 (炼器) ▼▼▼
        else if (p.location === "wan_jian" || p.location === "wanjian" || p.location === "sword_sect") {
            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#e8eaf6; border:1px solid #3f51b5; border-radius:5px;">
                    <div style="font-weight:bold; color:#303f9f; margin-bottom:5px;">⚔️ 万剑山 - 铸剑池</div>
                    <div style="font-size:12px; color:#555; margin-bottom:8px;">
                        引天雷淬火，锻造神兵利器。<br>
                        当前炼器术: Lv.${(p.skills.forging ? p.skills.forging.level : 0)}
                    </div>
                    <button class="btn" style="background:#3f51b5; color:white; width:100%;" 
                        onclick="window.openCraftingMenu('forging')">
                        🔨 锻造兵甲
                    </button>
                </div>`;
        
            } else if (p.location === "wild") {
            const ws = gameState.wildStatus;
            const dirNames = { north: "北原", south: "南荒", east: "东林", west: "西矿", center: "中谷" };
            const depthNames = ["表层", "中层", "深层", "核心"];
            
            // 基础信息显示
            let infoHtml = `<div style="font-weight:bold; color:#27ae60; margin-bottom:10px;">
                📍 当前位置：${dirNames[ws.direction]} (${depthNames[ws.depth]})
            </div>`;

            let navHtml = "";
            // 如果在表层且是中心，显示方向选择
            if (ws.depth === 0 && ws.direction === 'center') {
                navHtml = `
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;">
                        <div></div><button class="btn-s" onclick="window.handleWildExplore('move','north')">向北</button><div></div>
                        <button class="btn-s" onclick="window.handleWildExplore('move','west')">向西</button>
                        <button class="btn-s" style="background:#95a5a6; color:white;">入口</button>
                        <button class="btn-s" onclick="window.handleWildExplore('move','east')">向东</button>
                        <div></div><button class="btn-s" onclick="window.handleWildExplore('move','south')">向南</button><div></div>
                    </div>`;
            } else {
                // 如果已经选了方向或深入了，显示“深入”和“后退”
                navHtml = `
                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <button class="btn" style="flex:1; background:#8e44ad; color:white;" onclick="window.handleWildExplore('deeper')">🎋 继续深入</button>
                        <button class="btn" style="flex:1; background:#34495e; color:white;" onclick="window.handleWildExplore('back')">🚶 往回走</button>
                    </div>`;
            }

            actionHtml = `
                <div style="margin-top:10px; padding:10px; background:#f0fff0; border:1px solid #27ae60; border-radius:5px;">
                    ${infoHtml}
                    ${navHtml}
                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <button class="btn" style="flex:1; background:#2ecc71; color:white;" onclick="window.handleGather('${ws.direction}')">🌿 就地采集</button>
                        <button class="btn" style="flex:1; background:#c0392b; color:white;" onclick="window.handleWildHunt()">⚔️ 就地狩猎</button>
                    </div>
                </div>`;
        }

        // 4. 渲染进去
        sceneContainer.innerHTML = actionHtml;
    }
}
export function openDetail(personId) {
    let person = findPerson(personId);
    if (!person) return;
// 缓存配置引用，减少长路径查找
    const ageCfg = G_CONFIG.AGE;
    const threshCfg = G_CONFIG.THRESHOLD;
    const durationCfg = G_CONFIG.DURATION;
    // 更新全局选中项
    gameState.selectedPersonId = personId;
    let isPlayer = (person.id === gameState.player.id);
    const getCost = (type) => G_CONFIG.ACTIONS[type.toUpperCase()]?.COST || 0;
        // --- R18 判定条件 ---
    // 开关开启 + 对方是男性 + 不是玩家自己 (看你自己想不想看自己的身体数据，这里假设只看 NPC)
    const showR18Panel = gameState.settings && gameState.settings.enableR18 && person.gender === '男';
       // 样式美化：给按钮统一加一点阴影和圆角，并根据类型微调
    const makeBtn = (label, actionType, color, style="") => {
        // 1. 安全获取配置
        const actionKey = actionType.toUpperCase();
        const actionCfg = (typeof G_CONFIG !== 'undefined' && G_CONFIG.ACTIONS) 
                          ? (G_CONFIG.ACTIONS[actionKey] || G_CONFIG.ACTIONS[actionType]) 
                          : null;
    
        // 2. 获取 Cost
        let cost = actionCfg ? actionCfg.COST : 0;
    
        let currentAP = (gameState.player && gameState.player.ap !== undefined) ? gameState.player.ap : 0;

    let finalLabel = cost > 0 ? `${label} (-${cost})` : label;

    // 4. 判定是否付得起
    let canAfford = currentAP >= cost;

    // 返回按钮 HTML
    return btnHtml(
        finalLabel, 
        `window.action('${actionType}', ${person.id})`, 
        color, 
        `width:100%; box-shadow:0 2px 5px rgba(0,0,0,0.1); ${style}`, 
        !canAfford // 如果付不起，按钮变灰
    );
};
    // --- 1. 数据准备 (增强版) ---

// 获取所在地名称
let locName = (typeof getLocationName === 'function') ? getLocationName(person.location) : "未知之地";

// 解决“未知之地”：如果是固定 NPC 且数据异常，尝试通过其所属势力定位
if (locName === "未知之地" && person.homeSect) {
    locName = getLocationName(person.homeSect);
}

// 势力/宗门显示逻辑：区分宗门与世家
let sectName = "一介散修";
if (person.homeSect) {
    let sectObj = LOCATIONS[person.homeSect];
    if (sectObj) {
        // 如果是沈家或莫家，可以加个前缀区分世家与宗门
        let prefix = (person.homeSect.includes('family') || person.homeSect.includes('mo_')) ? "🏠 " : "🏔️ ";
        sectName = prefix + sectObj.name;
    } else {
        sectName = person.homeSect;
    }
}
    
    let combatPower = (typeof getCombatPower === 'function') ? getCombatPower(person) : person.power;
    let combatColor = combatPower > person.power ? "#e74c3c" : "#7f8c8d";
    
    // 状态文本
    let statusText = "正常";
    if (person.pregnancyProgress >= durationCfg.PREGNANCY_LOG) statusText = `🫃 孕育中 (${person.pregnancyProgress}月)`;
    else if (person.pregnancyProgress > 0) statusText = "身体微恙"; 
    
  statusText += person.spouseId ? " | ❤ 已婚配" : " | 🐶 单身";
    
    if (person.power === 0) {
        if (person.age <= 3) statusText += " | 🍼 襁褓";
        else if (person.age < ageCfg.ADULT) statusText += " | 🌱 幼年";
        else statusText += " | 💀 濒死";
    }
    if (person.isImprisoned) statusText += " | ⛓️ 囚禁中";
    if (person.isDemonic) statusText += " | 😈 入魔";
    if (!isPlayer && typeof isRelated === 'function' && isRelated(gameState.player, person)) {
        if (person.isStockholm) {
            statusText += " | <span style='color:#ff4757; font-weight:bold;'>💞 扭曲的依恋</span>";
        } else if (person.isNemesis) {
            statusText += " | <span style='color:#6d214f; font-weight:bold;'>💀 不共戴天</span>";
        } else {
            statusText += " | <span style='color:#7f8c8d;'>📜 家族血脉</span>";
        }
    } else {
    if (person.isNemesis) statusText += " | 💢 仇敌";
    if (person.isStockholm) statusText += " | ❤️‍🔥 扭曲之爱";
    }
    if (person.isDead) statusText = "🕯️ 已故"; 

    // 标签生成
    let tagsHtml = person.traits.map(t => {
        let c = t.grade >= 4 ? "god" : (t.grade >= 2 ? "good" : (t.grade === 0 ? "bad" : "neutral"));
        // R18 特质特殊样式
        let style = "cursor:help;";
        if (t.type === 'r18') {
            style += "border-color: #e91e63; color: #e91e63; background: rgba(233,30,99,0.05);";
        }
        return `<span class="tag ${c}" title="${t.desc}" style="${style}">${t.name}</span>`;
    }).join('') || '<span style="color:#ccc;font-size:12px">无特殊体质</span>';

    // 亲属关系
    let fatherObj = person.fatherId ? findPerson(person.fatherId) : null;
    let motherObj = person.motherId ? findPerson(person.motherId) : null;
    let fatherHtml = fatherObj ? Text.formatName(fatherObj) : "<span style='color:#999'>不明</span>";
    let motherHtml = motherObj ? Text.formatName(motherObj) : "<span style='color:#999'>不明</span>";

    // 配偶显示修复
    let spouseHtml = "<span style='color:#999'>无</span>"; 
    let targetSpouseId = person.spouseId;
    // 2. 特殊修正：如果你在看玩家自己，那配偶ID就是全局的 spouseId
    if (isPlayer) targetSpouseId = gameState.spouseId;
    if (!isPlayer && person.id === gameState.spouseId) {
        targetSpouseId = gameState.player.id;
    }

    if (targetSpouseId) {
        // 情况A: 配偶是玩家 (显示红色的“你”)
        if (targetSpouseId === gameState.player.id) {
            spouseHtml = `<strong style="color:#e74c3c">${gameState.player.name} (你)</strong>`;
        } 
        // 情况B: 配偶是NPC
        else {
            let spouseObj = gameState.npcs.find(n => n.id === targetSpouseId);
            if (!spouseObj && typeof findPerson === 'function') spouseObj = findPerson(targetSpouseId);
            
            if (spouseObj) {
                 spouseHtml = (typeof Text !== 'undefined' && Text.formatName) ? Text.formatName(spouseObj) : spouseObj.name;
            }
        }
    }
    // ▲▲▲▲▲▲ 配偶显示修复结束 ▲▲▲▲▲▲

    // 子女
    let allPotentialChildren = [...gameState.npcs, ...gameState.children];
    if (gameState.player) allPotentialChildren.push(gameState.player);
    let myChildren = allPotentialChildren.filter(p => p.fatherId === person.id || p.motherId === person.id);
    let childrenHtml = myChildren.length > 0 ? myChildren.map(c => Text.formatName(c)).join(", ") : "<span style='color:#ccc'>无</span>";
    // ★★★【新增】血脉显示逻辑 (双轨制) ★★★
    let purity = person.bloodlinePurity || 0;
    let purityHtml = "";
    
    // 只有浓度 > 0 才显示条 (凡人如果不显示，界面更清爽)
    if (purity > 0) {
        // 判断是否为自家血脉 (玩家本人，或玩家的直系子女)
        // 逻辑：ID是玩家，或者父母一方是玩家
        let isTrueBlood = (person.id === gameState.player.id) || 
                          (person.fatherId === gameState.player.id) ||
                          (person.motherId === gameState.player.id);
                          
        let labelName, labelColor, labelDesc, boxStyle;
        
        if (isTrueBlood) {
            // === 👑 天凤真血 (自家) ===
            labelName = "天凤真血";
            labelColor = purity < 10 ? "#e74c3c" : "#f1c40f"; // 红 -> 金
            labelDesc = "始祖传承 · 吞噬进化";
            // 样式：带一点金色边框
            boxStyle = `border:1px solid ${labelColor}; background:rgba(255,215,0,0.05);`;
        } else {
            // === 🧬 神血激发度 (野生/配偶) ===
            labelName = "血脉灵犀";
            labelColor = purity < 10 ? "#3498db" : "#9b59b6"; // 蓝 -> 紫
            labelDesc = "神血共鸣 · 可堪融合";
            // 样式：带一点紫色边框
            boxStyle = `border:1px solid ${labelColor}; background:rgba(155,89,182,0.05);`;
        }
        
        purityHtml = `
            <div class="detail-attr-row" style="margin-top:8px; padding:6px; border-radius:4px; ${boxStyle}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; color:${labelColor}; font-weight:bold;">${labelName}</span>
                    <span style="font-size:16px; font-weight:bold; color:${labelColor};">${purity}%</span>
                </div>
                <div style="font-size:10px; color:#777; margin-top:2px;">${labelDesc}</div>
                <div style="font-size:10px; color:#555;">修炼修正: +${purity}%</div>
            </div>
        `;
    }
    // ============================================
    // ▼▼▼ 新增：构建 R18 身体开发度面板 ▼▼▼
    // ============================================
    let r18PanelHtml = "";
    if (showR18Panel) {
        let yangStatus = person.hasPrimalYang 
            ? `<span style="color:#e67e22; font-weight:bold; text-shadow:0 0 5px rgba(230,126,34,0.3);">🌞 元阳未泄 (纯阳)</span>` 
            : `<span style="color:#95a5a6; text-decoration:line-through;">🌑 元阳已失</span>`;

        
        let partsHtml = "";
        const bodyDefs = (G_CONFIG.R18_CONFIG && G_CONFIG.R18_CONFIG.BODY_PARTS) ? G_CONFIG.R18_CONFIG.BODY_PARTS : {};
        const stats = person.bodyStats || {};

       // 遍历配置里的每一个部位
        for (let key in bodyDefs) {
            let label = bodyDefs[key];
            let val = stats[key] || 0;
            
            // 颜色逻辑
            let barColor = "#3498db"; 
            if(val > 30) barColor = "#9b59b6"; 
            if(val > 70) barColor = "#e91e63";

            // ▼▼▼ 修改点：增加 onclick 事件，鼠标悬停变小手，增加点击反馈动画类 ▼▼▼
            partsHtml += `
                <div onclick="window.R18.touchBodyPart(${person.id}, '${key}')" 
                     class="r18-part-row"
                     style="margin-bottom:6px; font-size:12px; cursor:pointer; user-select:none; transition: transform 0.1s;"
                     onmousedown="this.style.transform='scale(0.98)'" 
                     onmouseup="this.style.transform='scale(1)'"
                     title="消耗1精力进行抚摸开发">
                    
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span style="color:#555;">${label}</span>
                        <span style="color:${barColor}; font-weight:bold;">${val}%</span>
                    </div>
                    <div style="width:100%; height:6px; background:#ecf0f1; border-radius:3px; overflow:hidden;">
                        <div style="width:${Math.min(val, 100)}%; height:100%; background:${barColor}; box-shadow:0 0 5px ${barColor}; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }

        // 这是一个独立的竖长条栏目
        r18PanelHtml = `
            <div class="detail-r18-column" style="
                border-right: 1px dashed #e91e63; 
                padding-right: 15px; 
                margin-right: 15px; 
                min-width: 180px; 
                display: flex; 
                flex-direction: column;
            ">
                <div style="font-size:16px; font-weight:bold; color:#e91e63; margin-bottom:10px; text-align:center; border-bottom:2px solid #e91e63; padding-bottom:5px;">
                    🔞 身体秘辛
                </div>
                <div style="background:rgba(233,30,99,0.05); padding:8px; border-radius:6px; margin-bottom:10px; text-align:center;">
                    ${yangStatus}
                </div>
                <div style="flex:1; overflow-y:auto; padding-right:5px; max-height: 450px;">
                    ${partsHtml}
                </div>
            </div>
        `;
    }
    // ▲▲▲ R18 面板构建结束 ▲▲▲
    // --- 按钮逻辑 ---
    let histBtn = `<span style="cursor:pointer; font-size:16px; margin-right:4px;" title="查看生平履历" onmouseover="window.playSound('hover')" onclick="window.openHistory(${person.id}); event.stopPropagation();">📜</span>`;
    let treeBtn = `<span style="display:inline-block; margin-right:6px; padding:1px 6px; border-radius:10px; background:#8e44ad; color:#fff; font-size:11px; cursor:pointer;" title="查看家族族谱" onmouseover="window.playSound('hover')" onclick="window.openFamilyTree(${person.id}); event.stopPropagation();">🌳 查看族谱</span>`;

    let btns = "";
    let isSameLocation = (person.location === gameState.player.location);
    if (isPlayer || person.isDead) isSameLocation = true; 

    if (!isSameLocation) {
        let hisLoc = getLocationName(person.location);
        let myPurity = gameState.player.bloodlinePurity || 0;
        let pullBtn = "";
        if (myPurity > 80) {
            pullBtn = makeBtn("🌌 宿命牵引", "divine_pull", "btn-force", "margin-top:10px; background:#9b59b6;");
        }
        btns = `<div style="grid-column:1 / -1; text-align:center; color:#7f8c8d; padding:20px; border:2px dashed #eee; border-radius:8px; background:#fafafa;">
                    <div style="font-size:16px; margin-bottom:5px;">🚫 鞭长莫及</div>
                    <div style="font-size:12px;">对方身在 <strong>[${hisLoc}]</strong><br>需前往该地才可互动</div>
                    ${pullBtn}
                </div>`;
    } else {
        if (person.isDead) {
            btns = `<div style="grid-column:1 / -1; text-align:center; color:#999; padding:10px;">🍂 斯人已逝...</div>`;
            const isMyChild = gameState.children.some(c => c.id === person.id);
            if (!isPlayer && isMyChild && person.age >= ageCfg.ADULT) {
                 btns += btnHtml("👻 夺舍重生", `window.attemptSeize(${person.id})`, "btn-force", "width:100%; grid-column:1 / -1;");
            }
        } else if (!isPlayer) {
             if (person.isNemesis) {
                 btns += makeBtn("🕊️ 劝说化解", "persuade_menu", "btn-marry");
                 if (person.love > G_CONFIG.ACTIONS.BOND_RESOLVE.THRESHOLD_DEFAULT) btns += makeBtn("💕 枕榻销怨", "bond_resolve", "btn-baby");
             }
             btns += makeBtn("🗣️ 交谈", "talk", "btn-talk");
             btns += makeBtn("🎁 赠礼", "gift", "btn-gift");
             btns += makeBtn("☯ 论道", "discuss_dao", "btn-persuade");
             const isHighRank = ["elder", "master"].includes(person.rank); // 判断身份是否尊贵
const limit = (G_CONFIG.TEACH && G_CONFIG.TEACH.RELATION_LIMIT) ? G_CONFIG.TEACH.RELATION_LIMIT : 60;
const meetRelation = person.favor >= limit;
if (isHighRank && meetRelation) {
    // 逻辑判定：如果本月已学过，按钮置灰且不可点击
    const btnClass = gameState.monthlyLearned ? "btn-disabled" : "btn-talk"; // 借用现有样式
    const btnStyle = gameState.monthlyLearned 
        ? "background:#bdc3c7; color:#666; cursor:not-allowed;" 
        : "background: linear-gradient(135deg, #8e44ad, #9b59b6); color:white; font-weight:bold;";
    
    // 注意：这里的 actionType 对应我们在 logic.js 中注册的处理逻辑
    btns += `<button class="btn" style="${btnStyle}" onclick="window.handleTeachSkill('${person.id}')">
                📖 请教绝技
             </button>`;
}
             // --- 【新增】神性指令按钮显示 ---
             let myPurity = gameState.player.bloodlinePurity || 0;
             // 1. 神性威压：浓度 > 60% 或 对方是灵魂伴侣且浓度 > 30%
             if (myPurity > 60 || (person.isSoulMate && myPurity > 30)) {
                 btns += makeBtn("👑 神性威压", "divine_confiscate", "btn-force", "background: linear-gradient(to bottom, #f1c40f, #d35400); color:white;");
             }
             // 2. 宿命牵引：浓度 > 80% (全图召唤，所以不一定要在同地)
             // 注意：我们在 actions.js 里已经判定了地点，但神性指令应该支持远程召唤
             if(!person.isImprisoned) {
                if (person.items && person.items.length > 0) {
    btns += makeBtn("🖐️ 偷窃", "steal", "btn-steal");
}
                 btns += makeBtn("⚔️ 攻击", "attack", "btn-attack");
               // --- 🆕 Phase 3: 迷情香按钮 ---
                 // 只有当：玩家有Buff 且 对方不是小孩 且 没死
                 if (gameState.player.buffs && gameState.player.buffs.charm_smoke && person.age >= ageCfg.ADULT) {
                     // 这是一个红色的、带火焰特效的按钮
                     // 注意：这里我们直接用 btnHtml 手写一个样式独特的按钮
                     let style = "width:100%; padding: 12px 0; background: linear-gradient(45deg, #c0392b, #e74c3c); color:white; font-weight:bold; border:1px solid #96281b; box-shadow: 0 0 8px rgba(192, 57, 43, 0.6); animation: pulse 2s infinite;";
                     btns += btnHtml("🔥 强行春宵 (迷情)", `window.action('force_woohoo_charm', ${person.id})`, "", style);
                 }
                 // 对接提亲门槛 (FAVOR_PROPOSE: 60, LOVE_PROPOSE: 20)
                 let canPropose = !gameState.spouseId && !person.spouseId && 
                                  person.favor >= threshCfg.FAVOR_PROPOSE && 
                                  person.love >= threshCfg.LOVE_PROPOSE;
                 if(canPropose) btns += makeBtn("💍 提亲", "marry_request", "btn-marry");

                 // 对接共度春宵门槛 (FAVOR_LOVE: 60, LOVE_PROPOSE: 20)
                 let canBaby = (gameState.spouseId === person.id) || 
                               (person.favor >= threshCfg.FAVOR_LOVE && person.love >= threshCfg.LOVE_PROPOSE);
                 if(canBaby) btns += makeBtn(gameState.spouseId === person.id ? "🌙 共度良宵" : "🌸 共度春宵", "baby", "btn-baby");
                 if(person.power === 0) {
                     btns += makeBtn("💀 处决", "kill", "btn-kill", "margin-top:5px;");
                     btns += makeBtn("⛓️ 囚禁", "kidnap", "btn-kidnap", "margin-top:5px;");
                 }
             } else {
                btns += makeBtn("💸 勒索亲友", "blackmail_relative", "btn-force", "background: #2c3e50; color: #ecf0f1; margin-bottom:5px;");
                 btns += makeBtn("🕊️ 放走", "release", "btn-release");
                 btns += makeBtn("🎒 搜刮", "confiscate", "btn-steal");
                 btns += makeBtn("🔥 强行", "force_baby", "btn-force");
                 btns += makeBtn("💀 处决", "kill", "btn-kill");
             }
        }
        if (gameState.spouseId === person.id && !person.isDead) {
            btns += makeBtn("💔 协议离婚", "divorce", "btn-divorce");
            if (gameState.player.power > person.power || person.isNemesis || person.darkness > threshCfg.DARK_FAIL_HIGH) {
                 btns += makeBtn("💪 强行休妻/夫", "divorce_force", "btn-divorce-force");
            }
        }
    }

    let containerClass = isPlayer ? "modal-detail is-player" : "modal-detail";
    let modalStyle = "";
    if (showR18Panel) {
        modalStyle = "width: 900px; max-width: 95vw; grid-template-columns: 200px 220px 240px 1fr;"; // 四栏布局
    }

    let emotionSectionStyle = isPlayer ? "display:none;" : "";
    let actionsContent = isPlayer ? "" : btns;

    let bigAvatarHtml = getAvatarHtml(person, 160);// 生成 120px 的大头像
    let r18BodyHtml = ""; 
    if (showR18Panel) {
        // 生成阳具描述
        let genitalText = "";
        if (person.genital) {
            const g = person.genital;
            genitalText = `
                <div style="margin-top:8px; padding:6px; background:rgba(233,30,99,0.05); border-radius:4px; border-left:3px solid #e91e63; font-style: normal;">
                    <span style="color:#e91e63; font-weight:bold;">🔞 阳具：</span>
                    <span style="color:#444;">${g.size}，${g.hardness}。冠头${g.glans.shape}(${g.glans.color})，${g.glans.feature}，茎身${g.shaft}，${g.scrotum}，高潮时${g.fluid}。</span>
                </div>`;
        }
        // 生成胸膛描述
        let chestText = "";
        if (person.chest) {
            const c = person.chest;
            chestText = `
                <div style="margin-top:6px; padding:6px; background:rgba(63,81,181,0.05); border-radius:4px; border-left:3px solid #3f51b5; font-style: normal;">
                    <span style="color:#3f51b5; font-weight:bold;">💪 胸膛：</span>
                    <span style="color:#555;">${c.type}，${c.muscle}。${c.skin}，乳头${c.nipple}，胸毛${c.hair}。</span>
                </div>`;
        }
        r18BodyHtml = genitalText + chestText;
    }
    let htmlContent = `
        <div class="modal ${containerClass}" style="${modalStyle}">
            <div style="position:absolute; top:12px; right:18px; cursor:pointer; font-size:20px; color:#999;" 
                 onclick="window.closeModalElement(this)">×</div>

            ${r18PanelHtml}

            <div class="detail-left">
                <div style="display:flex; justify-content:center; margin-bottom:15px;">
                    ${bigAvatarHtml}
                </div>   
                <div style="font-size:20px; font-weight:bold; color:var(--main-color); margin-bottom:4px;">
                    ${histBtn}${treeBtn}${person.name}
                    <span class="personality-label">${person.personality.name}</span>
                </div>
                <div style="color:#666; font-size:13px; margin-bottom:6px;">
                    ${person.gender} · ${person.age}岁
                    <span class="realm-badge">${getRealmName(person.power)}</span>
                </div>
                <div style="font-size:12px; color:#555; font-style:italic; margin:8px 0; padding:6px 8px; background:#f9f9f9; border-radius:4px;">
                    <div style="display:flex; align-items:center; color:#2980b9; font-weight:bold; margin-bottom:4px;">
                        <span style="margin-right:4px;">📍</span> 
                        <span>所在地: ${locName}</span>
                        ${person.location === gameState.player.location ? ' <span style="margin-left:8px; font-size:10px; color:#27ae60; font-style:normal;">[同地]</span>' : ''}
                    </div>
                   ${Text.getAppearanceDesc(person)}
                  ${r18BodyHtml}
                </div>         
                <div style="margin-top:6px; margin-bottom:10px;">${tagsHtml}</div>
                <div style="border-top:1px dashed #eee; padding-top:6px; font-size:12px; color:#555;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <div>
                            <span style="color:#999;">父</span> ${fatherHtml} 
                            <span style="color:#ddd; margin:0 2px;">|</span> 
                            <span style="color:#999;">母</span> ${motherHtml}
                        </div>
                        <div>
                            <span style="color:#999;">伴侣</span> ${spouseHtml}
                        </div>
                    </div>
                    <div>
                        <span style="color:#999;">子嗣</span> <span style="line-height:1.4;">${childrenHtml}</span>
                    </div>
                </div>
            </div>

            <div class="detail-center">
                <div class="detail-attr-section">
                    <div class="detail-attr-title">🧾 身份信息</div>
                    <div class="detail-attr-row"><span>当前状态</span> <strong>${statusText}</strong></div>
                    <div class="detail-attr-row"><span>所属势力</span> <strong style="color:#2c3e50;">${sectName}</strong></div>
                    <div class="detail-attr-row"><span>持有物品</span> <span style="font-size:12px; color:#666; text-align:right; max-width:220px;">${person.items.join(", ") || "空空如也"}</span></div>
                </div>

                <div class="detail-attr-section">
                    <div class="detail-attr-title">📊 数值属性</div>
                    ${purityHtml}
                    <div class="detail-attr-row">
                        <span>门派身份</span> 
                        <span>${person.homeSect ? getLocationName(person.homeSect) : '散修'} · ${getNPCRankName(person)}</span>
                    </div>
                    <div class="detail-attr-row">
                        <span>境界修为</span> 
                        <div style="text-align:right;">
                            <div>
                                <strong>${getRealmName(person.power)}</strong> 
                                <span style="font-size:12px; color:#95a5a6">(${person.power})</span>
                            </div>
                            <div style="font-size:11px; color:${combatColor}; margin-top:2px;">
                                ⚔️ 战力 ${combatPower}
                            </div>
                        </div>
                    </div>
                    ${isPlayer ? (() => {
                        let buffs = window.getEquipmentBuffs ? window.getEquipmentBuffs() : {attack:0};
                        if (buffs.attack > 0 || buffs.hunting_rate > 0) {
                            return `
                            <div class="detail-attr-row" style="background:rgba(230, 126, 34, 0.1); border:1px dashed #e67e22;">
                                <span style="color:#d35400;">🗡️ 装备加成</span>
                                <span style="font-size:11px;">
                                    ${buffs.attack ? `攻+${buffs.attack} ` : ''}
                                    ${buffs.hunting_rate ? `猎+${Math.floor(buffs.hunting_rate*100)}% ` : ''}
                                    ${buffs.speed ? `速+${Math.floor(buffs.speed*100)}%` : ''}
                                </span>
                            </div>`;
                        }
                        return '';
                    })() : ''}
                    <div class="detail-attr-row"><span>智力谋略</span> <strong>${person.int}</strong></div>
                    <div class="detail-attr-row"><span>容貌魅力</span> <strong>${person.charm}</strong></div>
                </div>

                ${isPlayer ? `
                <div class="detail-attr-section">
                    <div class="detail-attr-title">⚒️ 技艺专精</div>
                    ${typeof getSkillPanelHtml === 'function' ? getSkillPanelHtml(person) : '未加载技能模块'}
                </div>
                ` : ''}
                <div class="detail-attr-section detail-attr-emotion" style="${emotionSectionStyle}">
                    <div class="detail-attr-title">💖 情感与心性</div>
                    <div class="detail-attr-row"><span>对你态度</span> <strong style="color:#d35400;">${person.favor}</strong></div>
                    <div class="detail-attr-row"><span>爱意羁绊</span> <strong style="color:#e91e63;">${person.love}</strong></div>
                    <div class="detail-attr-row"><span>黑化程度</span> <span style="color:#8e44ad; font-weight:bold;">${person.darkness}</span></div>
                </div>
            </div>

            <div class="detail-right">
                <div class="detail-right-title">🎯 可用互动</div>
                <div class="modal-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start;">
                    ${actionsContent}
                </div>
            </div>
        </div>
    `;

    // --- 3. 动态创建与刷新 ---
    let uniqueId = `modal-wrapper-${person.id}`;
    let existingOverlay = document.getElementById(uniqueId);

    if (existingOverlay) {
        existingOverlay.innerHTML = htmlContent;
        if(window.globalZIndex) window.globalZIndex++;
        existingOverlay.style.zIndex = window.globalZIndex;
        return;
    }

    let overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = uniqueId;
    overlay.style.display = 'flex';
    overlay.innerHTML = htmlContent;

    if (!window.globalZIndex) window.globalZIndex = 1000;
    window.globalZIndex++;
    overlay.style.zIndex = window.globalZIndex;

    overlay.onclick = function(e) {
        if (e.target === overlay) window.closeModalElement(overlay);
    };

    document.body.appendChild(overlay);
    if (window.playSound) window.playSound('popup');
}

// [ui.js] 完整替换 openHistory 函数

export function openHistory(personId) {
    console.log("👉 1. openHistory 开始运行，目标ID:", personId);

    // 1. 找人
    let person = findPerson(personId);
    
    // 2. 兜底逻辑：如果找不到，尝试用当前选中的人
    if (!person && gameState.selectedPersonId) {
        console.warn("⚠️ 原始ID找不到人，尝试使用 selectedPersonId:", gameState.selectedPersonId);
        person = findPerson(gameState.selectedPersonId);
    }

    // 3. 还是找不到，报错退出
    if (!person) {
        console.error("❌ 错误：完全找不到对应的角色数据！");
        return;
    }
    console.log("👉 2. 找到角色:", person.name);

    // 4. 生成 HTML (确保 History 模块正常)
    if (!History || !History.render) {
        console.error("❌ 错误：History 模块未加载或缺少 render 方法！");
        return;
    }
    let html = History.render(person);
    console.log("👉 3. 履历 HTML 生成完毕，长度:", html.length);

    // 5. 【最关键一步】找到 HTML 元素并显示！
    let contentEl = document.getElementById('historyContent');
    let modalEl = document.getElementById('historyModal');

    if (contentEl && modalEl) {
        contentEl.innerHTML = html;
        window.globalZIndex++; 
        modalEl.style.zIndex = window.globalZIndex;
        modalEl.style.display = 'flex'; // <--- 这行代码让弹窗显示！
        console.log("✅ 4. 成功！弹窗 style.display 已设置为 flex");
        
        // 播放音效
        if(window.playSound) window.playSound('popup');
    } else {
        console.error("❌ 错误：找不到 HTML 元素！请检查 id='historyContent' 和 'historyModal' 是否存在。");
    }
}
export function closeModal() { 
    document.getElementById('detailModal').style.display = 'none'; 
    document.getElementById('settingsModal').style.display = 'none'; 
    document.getElementById('inventoryModal').style.display = 'none';
    let histModal = document.getElementById('historyModal');
    if(histModal) histModal.style.display = 'none';
}

// [ui.js] 修复后的 openCharCreator (终极修正版)
export function openCharCreator() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('charCreator').style.display = 'flex';
    const container = document.getElementById('creatorControls');
    container.innerHTML = "";
    
    const keys = ['skins', 'hair_colors', 'hair_styles', 'eyebrows', 'eye_colors', 'eye_shapes', 'face_shapes', 'noses', 'lips', 'decorations', 'temperaments'];
    
    const labels = {
        skins: "肤色", hair_colors: "发色", hair_styles: "发型", eyebrows: "眉毛",
        eye_colors: "瞳色", eye_shapes: "眼型", face_shapes: "脸型",
        noses: "鼻型", lips: "唇形", decorations: "特征", temperaments: "气质"
    };

    keys.forEach(key => {
        let div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        let label = document.createElement('label');
        label.innerText = labels[key] || key;
        label.style.fontSize = "12px";
        label.style.fontWeight = "bold";
        
        let select = document.createElement('select');
        select.id = `sel_${key}`;
        select.style.padding = "5px";
        
        if(window.playSound) {
            select.onmouseover = () => window.playSound('hover'); 
            select.onchange = () => { window.playSound('click'); updateCreatorPreview(); }; 
        } else {
             select.onchange = () => updateCreatorPreview();
        }

        // === 核心修复：更准确的键名映射 ===
        let dbKey = key;
        let suffix = "_female"; // 既然锁死女性
        
        // 【关键点1】hair_styles 必须映射为 hair_styles_female
        if (key === 'hair_styles') dbKey = 'hair_styles' + suffix; 
        
        // 【关键点2】eye_shapes 映射为 eyes_female (根据你之前的data结构)
        else if (key === 'eye_shapes') dbKey = 'eyes' + suffix;
        
        // 其他部位的推测 (如果 data.js 里没分男女，这里找不到会回退找 key 原名)
        else if (key === 'eyebrows') dbKey = 'eyebrows' + suffix;
        else if (key === 'face_shapes') dbKey = 'faces' + suffix; // 如果 data 里叫 face_shapes 没分男女，下面逻辑会自动处理
        else if (key === 'noses') dbKey = 'noses' + suffix;
        else if (key === 'lips') dbKey = 'lips' + suffix;

        // 1. 优先找映射后的名字 (例如 hair_styles_female)
        let sourceData = DB.appearance[dbKey];
        
        // 2. 找不到就找原名 (例如 skins, 或者 face_shapes 如果没分男女)
        if (!sourceData) sourceData = DB.appearance[key];

        // === 遍历生成选项 ===
        if (sourceData && sourceData.length > 0) {
            sourceData.forEach(item => {
                let opt = document.createElement('option');
                opt.value = JSON.stringify(item); 
                opt.innerText = item.val;
                select.appendChild(opt);
            });
            // 随机选一个默认值
            let randomIdx = Math.floor(Math.random() * sourceData.length);
            select.selectedIndex = randomIdx;
        } else {
            // 【关键点3】给无数据选项一个空值，防止 JSON.parse 崩溃
            let opt = document.createElement('option');
            opt.innerText = "无数据";
            opt.value = ""; // <--- 加上这一行，JSON.parse("") 会被你的 try-catch 或者 if check 拦截
            select.appendChild(opt);
            console.warn(`未找到数据: ${key} (尝试查找: ${dbKey})`);
        }

        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    });
    
    if(window.updateCreatorPreview) updateCreatorPreview();
}

export function updateCreatorPreview() {
    const keys = ['skins', 'hair_colors', 'hair_styles', 'eyebrows', 'eye_colors', 'eye_shapes', 'face_shapes', 'noses', 'lips', 'decorations', 'temperaments'];
    let tempAppearance = {};
    keys.forEach(key => {
        let select = document.getElementById(`sel_${key}`);
       if(select) {
            // === 防报错修复 ===
            // 如果 value 是空的 (比如刚才的"无数据"占位符)，直接跳过，不要 parse
            if (!select.value) return; 

            try {
                let item = JSON.parse(select.value);
                tempAppearance[key] = item;
            } catch (e) {
                console.warn(`解析外观数据失败 key=${key}`, e);
            }
        }
    });
    tempAppearance.beautyScore = G_CONFIG.RATE.DEFAULT_BEAUTY
    let dummyPerson = { appearance: tempAppearance,
        gender: "女" // 玩家默认为女性，确保去 female 文件夹找图
    };
   let previewHtml = getAvatarHtml(dummyPerson, 180);
    let previewContainer = document.getElementById('charAvatarPreview');
    if (previewContainer) {
        previewContainer.innerHTML = previewHtml;
    }
    document.getElementById('creatorPreview').innerHTML = Text.getAppearanceDesc(dummyPerson);
}

// ui.js 中的 openInventory 替换版

export function openInventory() {
    // 1. 播放音效
    if(window.playSound) window.playSound('popup'); 
    
    const invList = document.getElementById('invList');
    invList.innerHTML = "";
    const p = gameState.player;

    // ▼▼▼ 新增：显示灵石数量 ▼▼▼
    // 在列表顶部插一个显示灵石的条
    let stonesHtml = `
        <div style="padding:10px; background:#fff8e1; color:#d35400; font-weight:bold; border-bottom:1px solid #eee; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
            <span>💎 当前灵石</span>
            <span style="font-size:16px;">${p.spiritStones || 0}</span>
        </div>
    `;
    // 先把这个塞进列表容器的前面（或者我们可以直接用 insertAdjacentHTML，但这里直接innerHTML重写比较简单）
    // 为了布局好看，我们把灵石显示放在 invList 里面作为第一个元素
    // 注意：CSS里 .inv-list 可能是 flex/column，所以直接加进去没问题
    
    let itemsHtml = "";
    if(p.items.length === 0) {
        itemsHtml = "<div style='padding:20px; text-align:center; color:#999;'>空空如也</div>";
    } else {
        // 遍历物品
        p.items.forEach((itemName, index) => {
            // 从 DB 里找描述
            let itemDef = DB.items.find(i => i.name === itemName) || {desc: "未知物品", effect: ""};
            
            itemsHtml += `
                <div class="inv-item" style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:#2c3e50;">${itemName}</div>
                        <div style="font-size:11px; color:#95a5a6;">${itemDef.desc}</div>
                    </div>
                    <button class="btn" style="background:#2ecc71; color:#fff; font-size:11px; padding:4px 8px;" 
                        onmouseover="window.playSound('hover')"
                        onclick="window.useItem(${index})">使用</button>
                </div>
            `;
        });
    }

    invList.innerHTML = stonesHtml + itemsHtml; // 拼接
    document.getElementById('inventoryModal').style.display = 'flex';
}

// --- 设置界面逻辑 ---
export function openSettings() {
    playSound('popup'); // 音效
    const s = gameState.settings;
    document.getElementById('set_r18').checked = s.enableR18; // [新增]
    // 日志设置
    document.getElementById('set_gossip').checked = s.showGossip;
    document.getElementById('set_battle').checked = s.showBattle;
    document.getElementById('set_birth').checked = s.showBirth;
    
    // 2. 音频设置 (新功能)
    document.getElementById('set_bgm').checked = s.enableBGM;
    document.getElementById('set_sfx').checked = s.enableSFX;
    
    // 【新增】音量滑块初始化
    // 注意：要先检查 gameState.settings.bgmVolume 是否存在(旧存档可能没有)，没有给默认值
    if (s.bgmVolume === undefined) s.bgmVolume = 0.4;
    if (s.sfxVolume === undefined) s.sfxVolume = 0.6;

    const bgmSlider = document.getElementById('vol_bgm');
    const sfxSlider = document.getElementById('vol_sfx');
    
    if (bgmSlider) bgmSlider.value = s.bgmVolume;
    if (sfxSlider) sfxSlider.value = s.sfxVolume;
    
    document.getElementById('display_bgm_vol').innerText = Math.round(s.bgmVolume * 100) + '%';
    document.getElementById('display_sfx_vol').innerText = Math.round(s.sfxVolume * 100) + '%';

    document.getElementById('settingsModal').style.display = 'flex';
}

// 【新增】调节音量函数
export function adjustVolume(type, val) {
    const volume = parseFloat(val);
    
    if (type === 'bgm') {
        gameState.settings.bgmVolume = volume;
        setBGMVolume(volume); // 实时应用到 audio
        document.getElementById('display_bgm_vol').innerText = Math.round(volume * 100) + '%';
    } else if (type === 'sfx') {
        gameState.settings.sfxVolume = volume;
        setSFXVolume(volume); // 实时应用到 audio
        document.getElementById('display_sfx_vol').innerText = Math.round(volume * 100) + '%';
    }
}

export function toggleSetting(key) {
    playSound('click'); // 开关点击音效
    if (key === 'enableR18') {
        gameState.settings.enableR18 = document.getElementById('set_r18').checked;
        return;
    }
    // 音频特殊处理
    if (key === 'enableBGM') {
        const isChecked = document.getElementById('set_bgm').checked;
        toggleBGM(isChecked);
        return;
    }
    if (key === 'enableSFX') {
        const isChecked = document.getElementById('set_sfx').checked;
        toggleSFX(isChecked);
        return;
    }

    if (gameState.settings.hasOwnProperty(key)) {
        gameState.settings[key] = !gameState.settings[key];
    }
}
// --- v0.34 新增：打开地图逻辑 ---
export function openMap() {
    const p = gameState.player;
    const modal = document.getElementById('mapModal');
    const list = document.getElementById('mapList');
    const currentNameEl = document.getElementById('mapCurrentLoc');

    // 1. 设置当前位置名字
    currentNameEl.innerText = getLocationName(p.location);

    // 2. 清空旧列表
    list.innerHTML = "";

    // 3. 遍历所有地点生成卡片
    Object.values(LOCATIONS).forEach(loc => {
        // ▼▼▼ 新增：如果这个地点还没解锁，就跳过不显示 ▼▼▼
        // 注意：兼容旧存档，如果 gameState.unlockedLocations 还没初始化，就默认显示前三个
        let unlockedList = gameState.unlockedLocations || ['sect', 'market', 'wild'];
        
        if (loc.hidden && !unlockedList.includes(loc.id)) {
            return; // 还没发现这个地方，隐藏！
        }
        // ▲▲▲ 新增 ▲▲▲
        // 如果是当前所在地，就不显示（或者显示但不可点击，这里选择不显示）
        if (loc.id === p.location) return;

        // 计算时间
        let time = getTravelTime(p.location, loc.id);

        // 根据地点类型决定颜色
        let color = "#34495e"; // 默认黑
        let typeText = "中立";
        if (loc.type === 'safe') { color = "#2980b9"; typeText = "安全"; }
        if (loc.type === 'danger') { color = "#c0392b"; typeText = "凶险"; }

        // 创建卡片元素
        let item = document.createElement('div');
        item.className = "npc-card"; // 复用现有的卡片样式
        item.style.borderColor = color; // 边框颜色
        item.style.cursor = "default";  // 地图卡片本身不点击，点按钮
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        
        // 生成内部 HTML
        item.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:15px; color:${color}">
                    ${loc.name} <span class="tag" style="background:${color}">${typeText}</span>
                </div>
                <div style="font-size:12px; color:#666; margin-top:5px;">${loc.desc}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:12px; color:#888; margin-bottom:5px;">路途: <strong>${time}个月</strong></div>
                <button class="btn" style="background:${color}; color:white;" 
                    onmouseover="window.playSound('hover')" 
                    onclick="window.handleTravel('${loc.id}'); document.getElementById('mapModal').style.display='none';">
                    🚀 出发
                </button>
            </div>
        `;
        list.appendChild(item);
    });

    // 4. 显示弹窗并播放音效
    modal.style.display = 'flex';
    window.playSound('popup');
}
// 辅助函数：通过名字打开详情页 (供履历使用)
window.openDetailByName = function(name) {
    // 1. 先看看是不是点玩家自己
    if (gameState.player.name === name) {
        window.openDetail(gameState.player.id);
        return;
    }

    // 2. 在 NPC 列表里找
    let target = gameState.npcs.find(n => n.name === name);
    
    // 3. 在 子女 列表里找
    if (!target) {
        target = gameState.children.find(c => c.name === name);
    }

    // 4. 找到了就打开，找不到拉倒（可能人死了被删了）
    if (target) {
        window.openDetail(target.id);
    } else {
        console.warn(`未找到名为 ${name} 的角色，可能已死亡或消失。`);
        // 可选：提示一下用户
        // alert("该角色已不在人世，无法查看详情。");
    }
};
// --- 家族树系统 ---
// 1. 构建树状数据 (修复配偶查找逻辑)
// [ui.js] 修复版 buildFamilyTreeData (支持显示亡妻/前夫)
// [ui.js] 修复版：支持通过子女查找亡妻/前夫
function buildFamilyTreeData(rootId, depth = 0) {
    if (depth > 6) return null; // 防止无限递归

    let person = findPerson(rootId);
    if (!person) return null;

    // --- 1. 收集所有生物学子女 ---
    let allChars = [...gameState.children, ...gameState.npcs];
    // 也要把玩家算进去（万一玩家是某个NPC的孩子）
    if (gameState.player && gameState.player.id !== person.id) {
        allChars.push(gameState.player); 
    }

    let biologicalChildren = allChars.filter(c => c.fatherId === person.id || c.motherId === person.id);

    // --- 2. 查找配偶 (修复核心) ---
    let spouse = null;
    let targetSpouseId = person.spouseId;

    // A. 优先尝试当前的法定配偶
    if (person.id === gameState.player.id) targetSpouseId = gameState.spouseId; // 玩家特例
    if (person.id === gameState.spouseId) targetSpouseId = gameState.player.id; // 配偶特例

    if (targetSpouseId) {
        if (targetSpouseId === gameState.player.id) {
            spouse = gameState.player; // 配偶是玩家
        } else {
            spouse = findPerson(targetSpouseId); // 配偶是NPC
        }
    }

    // B. 【关键新增】如果没找到现任配偶，尝试通过子女反推“原来的配偶” (用于显示亡妻/前夫)
    if (!spouse && biologicalChildren.length > 0) {
        // 统计孩子们记录的另一个家长的ID
        let otherParentCounts = {};
        biologicalChildren.forEach(child => {
            // 如果我是男的，找孩子的妈；如果我是女的，找孩子的爸
            let otherId = (person.gender === '男') ? child.motherId : child.fatherId;
            if (otherId) {
                otherParentCounts[otherId] = (otherParentCounts[otherId] || 0) + 1;
            }
        });

        // 找出出现次数最多的那个ID (通常就是原配)
        let sortedIds = Object.keys(otherParentCounts).sort((a,b) => otherParentCounts[b] - otherParentCounts[a]);
        
        if (sortedIds.length > 0) {
            let exSpouseId = sortedIds[0];
            // 只有当这个人真的存在时才显示 (可能是死人，findPerson 能找到死人)
            let exSpouse = findPerson(exSpouseId);
            if (exSpouse) {
                spouse = exSpouse;
                // 我们给这种非现任关系打个标记，方便渲染时区分 (比如心碎图标)
                spouse._isEx = true; 
            }
        }
    }
    // ---------------------------

    // --- 3. 根据“树根”身份进行过滤 (保持原逻辑) ---
    let finalChildren = [];
    let isRootPlayer = (person.id === gameState.player.id);

    if (isRootPlayer) {
        // 玩家的族谱：只显示已认领的
        finalChildren = biologicalChildren.filter(c => {
            if (!c.isIllegitimate) return true;
            return gameState.children.some(child => child.id === c.id);
        });
    } else {
        // NPC的族谱：显示所有
        finalChildren = biologicalChildren;
    }

    // 按年龄排序
    finalChildren.sort((a, b) => b.age - a.age);

    return {
        person: person,
        spouse: spouse,
        children: finalChildren.map(c => buildFamilyTreeData(c.id, depth + 1)).filter(n => n !== null)
    };
}

// 2. 递归生成 HTML

// 核心修改：如果是私生子查看族谱，父母栏显示“父不详”

// 2. 递归生成 HTML (优化配偶显示)
// --- 辅助工具：生成家族树中的单张小卡片 ---
function createSingleTreeCard(p, focusId, isSpouse = false) {
    // 1. 样式处理
    let genderClass = p.gender === '女' ? 'tree-girl' : 'tree-boy';
    let stateStyle = p.isDead ? 'filter: grayscale(100%); opacity: 0.8;' : '';
    // 境界金边
    let rank = (typeof getRealmRank === 'function') ? getRealmRank(p.power) : 0;
    let borderStyle = rank >= 3 ? 'border: 2px solid #f1c40f;' : '';
    
    // 如果是配偶卡片，稍微缩小一点点，或者加个粉色边框区分？这里暂时保持一致
    if (isSpouse) {
        // borderStyle += " box-shadow: 0 0 5px pink;"; 
    }

    // 高亮当前选中的人
    if (focusId && p.id === focusId) {
        borderStyle = 'border: 2px solid #e74c3c; box-shadow: 0 0 10px rgba(231, 76, 60, 0.5); transform: scale(1.05); z-index:99;';
    }

    // 2. 徽章标记
    let badges = "";
    if (p.isDemonic) badges += "😈";
    if (p.traits && p.traits.some(t => t.name === '天凤血脉')) badges += "🔥";
    if (p.isImprisoned) badges += "⛓️";
    if (p.isIllegitimate) badges += "<span style='color:#c0392b; font-size:10px; font-weight:bold;'>(私)</span>";

    // 3. 地点/状态信息
    let locInfo = p.isDead ? "🪦 已故" : `📍 ${typeof getLocationName === 'function' ? getLocationName(p.location) : "未知"}`;

    // 4. 返回 HTML
   // 4. 返回 HTML (带立绘版)
    // 生成中等大小头像 (45px)
    let avatar = getAvatarHtml(p, 60);

    return `
        <div class="tree-member ${genderClass}" style="${stateStyle} ${borderStyle}; margin:0 5px; padding-top:5px;" onclick="window.openDetail(${p.id}); event.stopPropagation();">
            <div style="display:flex; justify-content:center; margin-bottom:4px;">
                ${avatar}
            </div>
            <div class="badges" style="position:absolute; top:-5px; right:-5px; font-size:14px; z-index:5;">${badges}</div>
            
            <div class="name" style="font-weight:bold; font-size:13px; color:#2c3e50;">
                ${p.name} <span style="font-size:10px; color:#7f8c8d;">${p.age}岁</span>
            </div>
            <div style="font-size:11px; color:#d35400; margin:2px 0;">${typeof getRealmName === 'function' ? getRealmName(p.power) : "未知境界"}</div>
            <div style="font-size:10px; color:#555; border-top:1px dashed #ddd; margin-top:2px; padding-top:2px;">
                ${locInfo}
            </div>
        </div>
    `;
}

// --- 2. 递归生成 HTML (双亲并排版) ---
function renderFamilyTreeHtml(node, focusId) {
    if (!node) return '';

    let p = node.person; // 主角
    let s = node.spouse; // 配偶

    // 1. 生成主角的卡片
    let mainCard = createSingleTreeCard(p, focusId, false);
    
    // 2. 生成配偶的卡片（如果有）
    let spouseCard = "";
    let connector = "";
    
    // [ui.js] 修改 renderFamilyTreeHtml 中间连接符部分
    
    if (s) {
        spouseCard = createSingleTreeCard(s, focusId, true);
        
        // --- 修改开始：动态心形图标 ---
        let connectorIcon = "❤"; // 默认红心
        let connectorStyle = "color:#e74c3c; animation:pulse 1s infinite;";

        // 检查是否是现任夫妻
        // 判定标准：s._isEx 标记 (这是我们在 buildFamilyTreeData 里手动加的)
        // 或者 双方 spouseId 不匹配
        let isCurrent = !s._isEx && (p.spouseId === s.id || s.spouseId === p.id);

        if (!isCurrent) {
            if (s.isDead || p.isDead) {
                connectorIcon = "🖤"; // 一方已故，用黑心
                connectorStyle = "color:#7f8c8d;"; 
            } else {
                connectorIcon = "💔"; // 离异/未婚，用碎心
                connectorStyle = "color:#95a5a6;";
            }
        }
        
        connector = `<div style="font-size:16px; margin:0 2px; ${connectorStyle}">${connectorIcon}</div>`;
        // --- 修改结束 ---
    }

    // 3. 组合成“夫妻档”容器
    // 使用 flex 布局让他们并排
    let contentHtml = `
        <div style="display:inline-flex; align-items:center; justify-content:center; padding:5px; background:rgba(255,255,255,0.3); border-radius:10px;">
            ${mainCard}
            ${connector}
            ${spouseCard}
        </div>
    `;

    // 4. 处理递归子节点
    if (node.children.length === 0) {
        return `<li>${contentHtml}</li>`;
    }

    let childrenHtml = node.children.map(childNode => renderFamilyTreeHtml(childNode, focusId)).join('');
    
    return `
        <li>
            ${contentHtml}
            <ul>
                ${childrenHtml}
            </ul>
        </li>
    `;
}

// 3. 打开家族树 (入口)
export function openFamilyTree(targetId) {
    // 1. 确定我们要查看的“焦点人物” (focusId)
    // 这个人会被高亮显示，我们以此人为基准寻找父母
    let focusId = targetId || gameState.player.id;
    let focusPerson = findPerson(focusId);
    
    if (!focusPerson) {
        alert("无法查询该角色的族谱（数据丢失）。");
        return;
    }

    // 2. 【核心修改】向上追溯一代，寻找真正的“树根”
    // 默认树根是自己
    let rootId = focusId;

    // 特殊逻辑：如果是玩家的私生子，且未被认领，那么在那个孩子的视角里，他不知道父亲是谁
    // 所以不能向上追溯到玩家，只能追溯到母亲，或者就是自己
    let isBastardOfPlayer = (focusPerson.fatherId === gameState.player.id && 
                             focusPerson.isIllegitimate && 
                             !gameState.children.some(c => c.id === focusId));

    // 优先找父亲 (前提：父亲存在，且不是“未相认的玩家父亲”)
    if (focusPerson.fatherId && findPerson(focusPerson.fatherId) && !isBastardOfPlayer) {
        rootId = focusPerson.fatherId;
    } 
    // 如果没父亲（或者父亲不认），再找母亲
    else if (focusPerson.motherId && findPerson(focusPerson.motherId)) {
        rootId = focusPerson.motherId;
    }

    // 3. 构建数据 (以找到的父母为根)
    let treeData = buildFamilyTreeData(rootId);
    
    // 防呆
    if (!treeData) {
        alert("族谱数据构建失败。");
        return;
    }
    
    // 4. 生成 HTML
    // 【重要】这里传入了第二个参数 focusId，用于在树中高亮显示原本要查的那个人
    let html = `<div class="tree"><ul>${renderFamilyTreeHtml(treeData, focusId)}</ul></div>`;
    
    // 5. 显示逻辑
    let container = document.getElementById('familyTreeContainer');
    let modalOverlay = document.getElementById('familyTreeModal');
    
    if (container && modalOverlay) {
        container.innerHTML = html;
        
        // 强制提升层级，确保盖住详情页
        if (typeof window.globalZIndex !== 'undefined') {
            window.globalZIndex++;
            modalOverlay.style.zIndex = window.globalZIndex;
        } else {
            modalOverlay.style.zIndex = 99999;
        }
        
        modalOverlay.style.display = 'flex';
        
        if(window.playSound) window.playSound('popup');
    }
}
// 挂载到 window
window.openFamilyTree = openFamilyTree;
// [ui.js] 新增辅助函数
// [ui.js] 优化后的 getAvatarHtml (支持方案B：幼年单图，成年拼装)
export function getAvatarHtml(person, size = 60) {
    // 1. 基础防护
    if (!person) {
        return `<div class="avatar-box" style="width:${size}px; height:${size}px; line-height:${size}px; text-align:center; color:#ccc; background:#f0f0f0; border-radius:10px;">?</div>`;
    }

    // === 方案B 核心修改：幼年期使用单张立绘 ===
    if (person.age < 16) {
        // 你需要准备两张图放在 assets/avatars/ 目录下：child_boy.png 和 child_girl.png
        let childImg = person.gender === "女" ? "child_girl.png" : "child_boy.png";
        return `
            <div class="avatar-box" style="width:${size}px; height:${size}px; overflow:hidden; border-radius:10px; background:#f0f0f0;">
                <img src="assets/avatars/${childImg}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='assets/avatars/child_girl.png'">
            </div>
        `;
    }
    // ============================================

    // 下面是成年人的拼装逻辑 (保持不变，但去掉了幼年判断)
    const app = person.appearance || {}; // 防止为 null
    let genderDir = person.gender === "女" ? "female" : "male"; // 只有这两个文件夹了
    let defaultPrefix = person.gender === "女" ? "_f_" : "_m_";

    // 脸型
    let faceId = (app.face_shapes && app.face_shapes.id) ? app.face_shapes.id : `face${defaultPrefix}01`;
    let skinFilter = (app.skins && app.skins.filter) ? app.skins.filter : "";
    
    // 眼睛
    let eyeObj = app.eye_shapes || app.eyes || {};
    let eyeId = eyeObj.socketId || eyeObj.id || `eye${defaultPrefix}01`;
    let pupilId = eyeObj.pupilId || (eyeId + "_pupil");
    let eyeFilter = (app.eye_colors && app.eye_colors.filter) ? app.eye_colors.filter : "";
    
    // 眉毛
    let browId = (app.eyebrows && app.eyebrows.id) ? app.eyebrows.id : null;
    let browFilter = (app.hair_colors && app.hair_colors.filter) ? app.hair_colors.filter : ""; 

    // 嘴巴
    let lipId = (app.lips && app.lips.id) ? app.lips.id : `mouth${defaultPrefix}01`;
    let lipFilter = ""; 

    // 发型
    let hairStyles = app.hair_styles || {};
    let hairFrontId = hairStyles.frontId || null;
    let hairBackUpId = hairStyles.backUpId || null;
    let hairBackLowId = hairStyles.backLowId || null;
    let hairFilter = (app.hair_colors && app.hair_colors.filter) ? app.hair_colors.filter : "";

    // 图层拼装
    let layersHtml = "";

    // 0. 脸型 (底层)
    if (faceId) layersHtml += `<img src="assets/avatars/${genderDir}/face/${faceId}.png" class="avatar-layer" style="filter: ${skinFilter}; z-index: 0;" onerror="this.style.display='none'">`;

    // 1. 后发下
    if (hairBackLowId) layersHtml += `<img src="assets/avatars/${genderDir}/hair/${hairBackLowId}.png" class="avatar-layer" style="filter: ${hairFilter}; z-index: 1;" onerror="this.style.display='none'">`;

    // 2. 后发上
    if (hairBackUpId) layersHtml += `<img src="assets/avatars/${genderDir}/hair/${hairBackUpId}.png" class="avatar-layer" style="filter: ${hairFilter}; z-index: 2;" onerror="this.style.display='none'">`;

    // 3. 眼睛 & 瞳孔
    if (eyeId) {
        layersHtml += `<img src="assets/avatars/${genderDir}/eyes/${eyeId}.png" class="avatar-layer" style="z-index: 3;" onerror="this.style.display='none'">`;
        layersHtml += `<img src="assets/avatars/${genderDir}/eyes/${pupilId}.png" class="avatar-layer" style="filter: ${eyeFilter}; z-index: 3;" onerror="this.style.display='none'">`;
    }

    // 4. 眉毛
    if (browId) layersHtml += `<img src="assets/avatars/${genderDir}/eyebrows/${browId}.png" class="avatar-layer" style="filter: ${browFilter}; z-index: 4;" onerror="this.style.display='none'">`;

    // 5. 嘴巴
    if (lipId) layersHtml += `<img src="assets/avatars/${genderDir}/mouth/${lipId}.png" class="avatar-layer" style="filter: ${lipFilter}; z-index: 5;" onerror="this.style.display='none'">`;

    // 6. 前发
    if (hairFrontId) layersHtml += `<img src="assets/avatars/${genderDir}/hair/${hairFrontId}.png" class="avatar-layer" style="filter: ${hairFilter}; z-index: 6;" onerror="this.style.display='none'">`;

    return `
        <div class="avatar-box" style="width:${size}px; height:${size}px; position:relative; overflow:hidden; border-radius:10px; background:#e0e0e0;">
            ${layersHtml}
        </div>
    `;
}
// ========================================================
// [ui.js] 新增：自定义弹窗逻辑 (Phase 1)
// ========================================================

// 1. 替代 alert
window.showAlert = function(msg, title="提示") {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerHTML = msg; // 支持HTML
    document.getElementById('alertModal').style.display = 'flex';
    if(window.playSound) window.playSound('popup');
};

window.closeCustomAlert = function() {
    document.getElementById('alertModal').style.display = 'none';
    if(window.playSound) window.playSound('click');
};

// 2. 替代 confirm (支持异步等待)
let confirmResolver = null;
window.showConfirm = function(msg, title="请确认") {
    return new Promise((resolve) => {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMsg').innerHTML = msg;
        document.getElementById('confirmModal').style.display = 'flex';
        confirmResolver = resolve;
        if(window.playSound) window.playSound('popup');
    });
};

window.resolveConfirm = function(result) {
    document.getElementById('confirmModal').style.display = 'none';
    if(window.playSound) window.playSound('click');
    if (confirmResolver) confirmResolver(result);
};

// 3. 替代 prompt (支持异步等待)
let inputResolver = null;
window.showInput = function(msg, defaultValue="", title="输入") {
    return new Promise((resolve) => {
        document.getElementById('inputTitle').innerText = title;
        document.getElementById('inputMsg').innerText = msg;
        let field = document.getElementById('inputField');
        field.value = defaultValue;
        document.getElementById('inputModal').style.display = 'flex';
        inputResolver = resolve;
        field.focus();
        if(window.playSound) window.playSound('popup');
    });
};

window.resolveInput = function(val) {
    document.getElementById('inputModal').style.display = 'none';
    if(window.playSound) window.playSound('click');
    if (inputResolver) inputResolver(val);
};

// 4. 多选菜单 (新增)
let choiceResolver = null;
window.showChoices = function(title, options) {
    // options 格式: [{text:"选项A", value:"A", color:"#e74c3c"}, ...]
    return new Promise((resolve) => {
        document.getElementById('choiceTitle').innerText = title;
        let list = document.getElementById('choiceList');
        list.innerHTML = "";
        
        options.forEach(opt => {
            let btn = document.createElement('button');
            btn.className = "btn";
            btn.innerText = opt.text;
            btn.style.width = "100%";
            btn.style.padding = "10px";
            btn.style.textAlign = "left";
            btn.style.background = opt.color || "#fff";
            btn.style.border = "1px solid #ccc";
            btn.style.color = opt.color ? "#fff" : "#333";
            // 如果是深色背景，加个粗
            if(opt.color) btn.style.fontWeight = "bold";
            
            btn.onclick = () => {
                document.getElementById('choiceModal').style.display = 'none';
                if(window.playSound) window.playSound('click');
                resolve(opt.value);
            };
            btn.onmouseover = () => { if(window.playSound) window.playSound('hover'); };
            
            list.appendChild(btn);
        });

        document.getElementById('choiceModal').style.display = 'flex';
        if(window.playSound) window.playSound('popup');
    });
};

window.resolveChoice = function(val) {
    document.getElementById('choiceModal').style.display = 'none';
    // 点击关闭按钮返回 null
};
// [ui.js] 新增：通用自定义弹窗函数
export async function showModal(title, content, type = 'alert', defaultValue = '') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('game-modal');
        const titleEl = document.getElementById('modal-title');
        const contentEl = document.getElementById('modal-content');
        const inputEl = document.getElementById('modal-input');
        const confirmBtn = document.getElementById('btn-confirm');
        const cancelBtn = document.getElementById('btn-cancel');

        // 1. 设置内容
        titleEl.textContent = title;
        // 支持 HTML 内容 (例如加粗)
        contentEl.innerHTML = content.replace(/\n/g, '<br>'); 
        
        // 2. 根据类型重置 UI
        inputEl.style.display = 'none';
        cancelBtn.style.display = 'none';
        inputEl.value = defaultValue;

        if (type === 'prompt') {
            inputEl.style.display = 'block';
            cancelBtn.style.display = 'block';
            inputEl.focus();
        } else if (type === 'confirm') {
            cancelBtn.style.display = 'block';
        }

        // 3. 打开弹窗 (Modeless)
        dialog.showModal();

        // 4. 定义清理函数 (防止事件监听器堆叠)
        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            dialog.close();
        };

        // 5. 绑定事件
        const onConfirm = () => {
            cleanup();
            if (type === 'prompt') resolve(inputEl.value);
            else resolve(true);
        };

        const onCancel = () => {
            cleanup();
            if (type === 'prompt') resolve(null); // Prompt取消返回 null
            else resolve(false); // Confirm取消返回 false
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}
window.showModal = showModal;
// [ui.js] 处理玩家死亡：弹出夺舍选择框
window.handlePlayerDeath = function(vessels) {
    // 播放死亡/警告音效
    if(window.playSound) window.playSound('click'); // 暂时用 click，建议后续加个 sad.mp3

    // 构建选项列表
    // 格式: [{text: "长女 云二丫 (28岁 炼气三层)", value: id, color: "#..."}, ...]
    let options = vessels.map(v => {
        let rank = (typeof getRealmRank === 'function') ? getRealmRank(v.power) : 0;
        let color = "#2ecc71"; // 默认绿色
        if (rank >= 2) color = "#3498db"; // 筑基蓝
        if (rank >= 3) color = "#9b59b6"; // 金丹紫
        if (v.int > 80 || v.charm > 80) color = "#f1c40f"; // 天才金

        return {
            text: `[${v.age}岁] ${v.name} - 魅力${v.charm} 智力${v.int}`,
            value: v.id,
            color: color
        };
    });

    // 强制弹窗 (无法关闭/取消)
    // 我们复用 showChoices，但需要稍微修改一下它的逻辑防止点背景关闭
    // 这里简单起见，我们直接调用 showChoices，玩家必须选一个
    window.showChoices("寿元已尽！请选择肉身转生", options).then(targetId => {
        if (targetId) {
            // 执行夺舍
            let success = window.executeSeize(targetId);
            if (success) {
                // 夺舍成功后，关闭所有弹窗，刷新界面
                document.getElementById('choiceModal').style.display = 'none';
                window.updateUI();
            }
        } else {
            // 如果玩家强行关闭了弹窗... 再次弹出！(死循环直到你选)
            window.handlePlayerDeath(vessels);
        }
    });
};

window.executeSeize = function(targetId) {
    let result = seizeBody(targetId);
    if (result) {
        // 成功动画/音效
        window.showAlert("夺舍成功！你已获得新生。", "转生");
    }
    return result;
}
window.playSound = playSound;
window.toggleBGM = toggleBGM;
window.toggleSFX = toggleSFX;
// [ui.js] 新增：主动触发夺舍逻辑
window.triggerActiveSeize = function() {
    // 1. 关闭设置弹窗
    closeModal();

    // 2. 检查是否有合法的容器（必须有活着的女儿）
    // 注意：我们需要引入 getValidVessels，但它在 logic.js。
    // 如果 logic.js 没有把 getValidVessels 挂载到 window，我们需要通过 window.gameState 里的 children 手动筛，
    // 或者确保 logic.js 导出了它。
    // 咱们简单点，直接利用现有的 window.handlePlayerDeath 逻辑，因为它里面会筛。
    
    // 为了防止 handlePlayerDeath 直接弹“寿元已尽”，我们这里手动筛一下，给个提示
    const validChildren = gameState.children.filter(c => !c.isDead && c.gender === '女' && !c.isImprisoned);

    if (validChildren.length === 0) {
        window.showAlert("膝下无适龄女儿可供夺舍！<br>（需有存活、未被囚禁的女性子嗣）", "传承失败");
        return;
    }

    // 3. 弹窗确认
    window.showConfirm("你确定要结束这一世的修行，<b>主动夺舍</b>后代吗？<br><br>你的旧身体将作为家族老祖（NPC）继续存在。", "转世确认").then(confirm => {
        if (confirm) {
            // 调用现有的夺舍界面，传入可选列表
            window.handlePlayerDeath(validChildren);
        }
    });
};
export function openSoulHistory() {
    // 1. 获取所有带有真魂标记的角色（包括已故的 NPC 和当前的 player）
    // 使用 Set 去重防止并发逻辑导致的重复显示
    const soulChain = [...gameState.npcs, gameState.player]
        .filter(n => n.isMainSoul)
        .sort((a, b) => (a.generation || 0) - (b.generation || 0));

    if (soulChain.length === 0) {
        showModal("家族底蕴", "暂无家族传承记录。始祖尚未觉醒。");
        return;
    }

    // 2. 构建 HTML 结构
    // 这里使用了带有“考古墨迹感”的 KaiTi 字体和修仙风格配色
    let html = `
        <div class="soul-history-container" style="
            padding: 10px; 
            color: #eee; 
            font-family: 'STKaiti', 'KaiTi', serif;
            max-height: 70vh;
            overflow-y: auto;
        ">
            <div class="timeline" style="
                border-left: 2px solid #9b59b6; 
                margin-left: 15px; 
                padding-left: 25px;
                position: relative;
            ">
    `;

    soulChain.forEach((m, index) => {
        const isCurrent = (m.id === gameState.player.id && !m.isDead);
        const accentColor = isCurrent ? "#2ecc71" : "#9b59b6";
        
        html += `
            <div class="soul-node" style="margin-bottom: 30px; position: relative;">
                <div class="dot" style="
                    width: 14px; height: 14px; 
                    background: ${accentColor}; 
                    border: 2px solid #fff;
                    border-radius: 50%; 
                    position: absolute; left: -33px; top: 4px;
                    box-shadow: 0 0 10px ${accentColor};
                "></div>
                
                <div class="soul-card" style="
                    background: rgba(255, 255, 255, 0.05); 
                    padding: 12px; 
                    border-radius: 8px; 
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-left: 4px solid ${accentColor};
                    box-shadow: 2px 2px 10px rgba(0,0,0,0.3);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="font-size: 1.2em; color: ${isCurrent ? '#2ecc71' : '#f1c40f'};">
                            第 ${m.generation} 代 · ${m.name}
                        </strong>
                        <span style="font-size: 0.8em; padding: 2px 8px; background: rgba(0,0,0,0.5); border-radius: 12px; color: ${accentColor}; border: 1px solid ${accentColor};">
                            ${isCurrent ? '真魂现世' : '归于轮回'}
                        </span>
                    </div>
                    
                    <div style="font-size: 0.95em; color: #ccc; line-height: 1.6;">
                        <span style="color: #888;">最终境界：</span>${getRealmName(m.power)}<br>
                        <span style="color: #888;">寿元终点：</span>${m.age} 岁<br>
                        
                        ${m.prevLifeName ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.9em; color: #999; font-style: italic;">
                                <span style="color: #9b59b6;">◈</span> 前世名为 [${m.prevLifeName}]，历经雷劫神魂不灭，借体而生。
                            </div>
                        ` : '<div style="margin-top: 8px; color: #888; font-size: 0.85em;">◈ 家族始祖：以此身开创万世不拔之基。</div>'}
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    
    // 调用现有的 showModal 显示
    showModal("家族底蕴 · 历代真魂传承轴", html);
}
// [ui.js] 新增：打开闭关输入框
window.openSeclusionInput = async function() {
    // 使用之前做好的 showInput 弹窗
    let input = await window.showInput("请输入闭关年数 (建议 1-10 年):", "1", "闭关修炼");
    
    // 简单的校验
    let years = parseInt(input);
    if (!isNaN(years) && years > 0) {
        // 调用逻辑层的执行函数
        if (window.executeSeclusion) {
            window.executeSeclusion(years);
        } else {
            console.error("未找到 window.executeSeclusion 函数，请检查 logic.js");
        }
    }
};
window.triggerAscensionEnding = async function() {
    const content = [
        "修真界所有的生灵皆感到心神猛地一颤。",
        "无不惊骇地抬头望向虚空。",
        "<br>·<br>",
        "你站在天穹之巅，俯瞰着下方的众生。",
        "那些曾经的人或物……此刻在你的眼中，竟是如此索然无味。",
        "你轻轻合上双眼，不再看这片已经被你玩弄的尘世。",
        "伴随着一声划破时空的凤鸣，你化作一道璀璨的金芒，消失在位面尽头。"
    ];

    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; color:#f1c40f; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; font-family:'KaiTi','STKaiti',serif; transition: opacity 3s; overflow-y: auto;";
    overlay.style.opacity = '0';
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.style.opacity = '1', 100);

    for (const line of content) {
        const p = document.createElement('p');
        p.innerHTML = line;
        p.style = "font-size:1.4em; text-align:center; opacity:0; transition: opacity 2s; margin-bottom:20px; width: 80%;";
        overlay.appendChild(p);
        await new Promise(r => setTimeout(r, 100)); 
        p.style.opacity = '1';
        await new Promise(r => setTimeout(r, 2500)); 
    }

    const endBtn = document.createElement('button');
    endBtn.innerText = "天凤飞升 · 功德圆满";
    endBtn.style = "margin-top:40px; padding:15px 40px; background:linear-gradient(to bottom, #f1c40f, #d35400); color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:1.2em; box-shadow: 0 0 20px #f1c40f;";
    endBtn.onclick = () => location.reload(); 
    overlay.appendChild(endBtn);
};
// --- 辅助：生成技能面板 HTML ---
function getSkillPanelHtml(p) {
    // 1. 确保技能对象存在 (数据兜底)
    if (!p.skills) p.skills = {};
    
    // 2. 定义我们要显示的技能列表 (键名 : 中文名)
    const skillMap = [
        { key: 'gathering', name: '🌿 采集', desc: '在大山中辨识灵材的能力' },
        { key: 'hunting',   name: '⚔️ 狩猎', desc: '对抗妖兽与追踪猎物的技巧' },
        { key: 'alchemy',   name: '💊 炼丹', desc: '提炼草木精华，炼制丹药' },
        { key: 'forging',   name: '🔨 炼器', desc: '锻造法宝，精炼矿石' },
        { key: 'secret_arts', name: '☯️ 合秘', desc: '阴阳调和与双修秘术' }
    ];

    let html = "";
    
    // 3. 遍历生成进度条
    skillMap.forEach(item => {
        let s = p.skills[item.key] || { level: 0, exp: 0 };
        
        // 获取升级所需经验 (调用 logic.js 里的公式，如果还没加载就兜底 100)
        let nextExp = (window.getUpgradeExp) ? window.getUpgradeExp(s.level) : 100 * Math.pow(1.5, s.level);
        nextExp = Math.floor(nextExp);

        // 计算百分比
        let percent = 0;
        if (s.level >= 10) { // 假设10级满级
            percent = 100;
            nextExp = "MAX";
        } else {
            percent = Math.min(100, Math.max(0, (s.exp / nextExp) * 100));
        }

        // 颜色逻辑：等级越高颜色越深
        let barColor = s.level > 5 ? "linear-gradient(90deg, #f1c40f, #e67e22)" : "linear-gradient(90deg, #3498db, #9b59b6)";

        html += `
            <div style="margin-bottom:8px;" title="${item.desc}">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px; color:#555;">
                    <span>${item.name} <span style="font-weight:bold; color:#2c3e50;">Lv.${s.level}</span></span>
                    <span style="font-size:10px; color:#999;">${s.exp} / ${nextExp}</span>
                </div>
                <div style="width:100%; height:6px; background:#ecf0f1; border-radius:3px; overflow:hidden;">
                    <div style="width:${percent}%; height:100%; background:${barColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;
    });

    return html || "<div style='font-size:12px; color:#999; text-align:center;'>暂无技艺</div>";
}
// --- 生产制造界面 ---
// --- 生产制造界面 (修复版：解决代码外露Bug) ---
// --- 生产制造界面 (修复版：解决弹窗层级遮挡问题) ---
window.openCraftingMenu = function(type) {
    const p = gameState.player;
    if (!G_CONFIG.RECIPES || !G_CONFIG.RECIPES[type]) {
        window.showAlert("该功能尚未配置配方数据！");
        return;
    }
    
    const recipes = G_CONFIG.RECIPES[type];
    const skill = p.skills[type] || { level: 0 };
    
    // 1. 准备材料统计
    let bagCounts = {};
    if (Array.isArray(p.items)) {
        p.items.forEach(i => bagCounts[i] = (bagCounts[i] || 0) + 1);
    } else {
        bagCounts = p.items || {};
    }

    // 2. 生成列表 HTML
    let listHtml = recipes.map(r => {
        let isLocked = skill.level < r.levelReq;
        let btnAttr = isLocked ? 'disabled' : '';
        let btnColor = type === 'alchemy' ? '#d35400' : '#3f51b5';
        
        let styleStr = `background:${btnColor}; color:white; font-size:12px; padding:4px 10px;`;
        if (isLocked) {
            styleStr += " opacity:0.5; cursor:not-allowed; filter:grayscale(100%);";
        }
        
        let levelClass = isLocked ? "color:#c0392b" : "color:#27ae60";

        let matHtml = Object.keys(r.materials).map(k => {
            let need = r.materials[k];
            let have = bagCounts[k] || 0;
            let color = have >= need ? "#27ae60" : "#c0392b";
            return `<span style="color:${color}">${k} (${have}/${need})</span>`;
        }).join("，");

        let rate = Math.min(95, Math.floor((r.baseChance + skill.level * 0.05) * 100));

        return `
            <div class="npc-card" style="margin-bottom:8px; border-left:4px solid ${type==='alchemy'?'#e67e22':'#3498db'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; font-size:14px;">${r.name}</div>
                    <div style="font-size:12px; ${levelClass}">需 Lv.${r.levelReq}</div>
                </div>
                <div style="font-size:11px; color:#7f8c8d; margin:4px 0;">${r.desc}</div>
                
                <div style="background:#f9f9f9; padding:5px; border-radius:4px; font-size:11px; color:#555;">
                    <div>⚙️ 消耗: 精力-${r.costAP}</div>
                    <div>📦 材料: ${matHtml}</div>
                    <div>🎲 成功率: <strong>${rate}%</strong></div>
                    <div>🎁 产出: ${r.output.normal} / <span style="color:#e74c3c">${r.output.rare}</span></div>
                </div>

                <div style="text-align:right; margin-top:5px;">
                    <button class="btn" ${btnAttr} style="${styleStr}" onclick="window.handleCraft('${type}', '${r.id}')">
                        开始${type==='alchemy'?'炼制':'锻造'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // 3. 构建弹窗 HTML (使用自定义覆盖层而非 showModal)
    let title = type === 'alchemy' ? '丹鼎阁 · 炼丹配方' : '万剑山 · 炼器配方';
    let htmlContent = `
        <div class="modal modal-detail" style="max-width: 400px; max-height: 80vh; display:flex; flex-direction:column;">
            <div style="position:absolute; top:12px; right:18px; cursor:pointer; font-size:20px; color:#999;" 
                 onclick="window.closeModalElement(this)">×</div>
            <div style="font-size:18px; font-weight:bold; margin-bottom:15px; text-align:center; border-bottom:1px solid #eee; padding-bottom:10px;">
                ${title}
            </div>
            <div style="overflow-y:auto; flex:1; padding-right:5px;">
                ${listHtml}
            </div>
        </div>
    `;

    // 4. 创建并显示弹窗 (手动管理 z-index)
    let overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = htmlContent;

    // 确保层级正确
    if (!window.globalZIndex) window.globalZIndex = 1000;
    window.globalZIndex++;
    overlay.style.zIndex = window.globalZIndex;

    overlay.onclick = function(e) {
        if (e.target === overlay) window.closeModalElement(overlay);
    };

    document.body.appendChild(overlay);
    if (window.playSound) window.playSound('popup');
};
// 显示夜袭事件弹窗
window.showNightAttackModal = function(visitor) {
    // 1. 生成文案
    let title = "🌙 深夜异响";
    let desc = `夜深人静之时，你的房门忽被轻轻推开。<br><br>`;
    
    if (visitor._justArrived) {
        desc += `<strong>[${visitor.name}]</strong> 竟然不远万里，御剑穿梭千里之遥来到你面前！<br>`;
    } else {
        desc += `原来是 <strong>[${visitor.name}]</strong> 趁夜潜入了你的房间。<br>`;
    }

    // 根据特质描写状态
    let stateDesc = "他面色潮红，呼吸急促，显然已是忍耐到了极限。";
    if (visitor.traits && visitor.traits.some(t => t.name.includes("成瘾"))) {
        stateDesc = "他双目含水，身体因长期的调教而微微颤抖，渴望着你的抚慰。";
    }
    desc += stateDesc + `<br><br>“...帮帮我，我受不了了...”他低声哀求道。`;

    // 2. 构建 HTML
    let html = `
        <div class="modal-overlay" style="display:flex; z-index:9999;">
            <div class="modal" style="width:400px; text-align:center; padding:20px; border: 2px solid #e91e63; box-shadow: 0 0 20px rgba(233,30,99,0.5);">
                <h2 style="color:#e91e63; margin-top:0;">${title}</h2>
                <div style="margin:20px 0; line-height:1.6; color:#333;">${desc}</div>
                
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button class="btn" style="background:#27ae60;" onclick="handleNightOption('${visitor.id}', 'accept')">
                        💕 顺水推舟 (接受)
                    </button>
                    <button class="btn" style="background:#8e44ad;" onclick="handleNightOption('${visitor.id}', 'dominate')">
                        👑 反客为主 (采补)
                    </button>
                    <button class="btn" style="background:#7f8c8d;" onclick="handleNightOption('${visitor.id}', 'reject')">
                        🚪 严词拒绝 (赶走)
                    </button>
                </div>
            </div>
        </div>
    `;

    // 3. 插入页面
    let div = document.createElement('div');
    div.id = 'night-attack-modal';
    div.innerHTML = html;
    document.body.appendChild(div);
};

// 处理点击选择
window.handleNightOption = function(id, choice) {
    // 移除弹窗
    let el = document.getElementById('night-attack-modal');
    if (el) el.remove();

    // 查找人
    let person = null;
    if (typeof findPerson === 'function') person = findPerson(Number(id));
    else if (gameState.npcs) person = gameState.npcs.find(n => n.id == id);

    if (person && window.R18) {
        // 执行结算
        let resultLog = window.R18.resolveNightAttack(person, choice);
        // 输出日志
        if (window.addLog) window.addLog(resultLog, "#e91e63");
        // 刷新一下主界面（如果需要）
        if (window.updateUI) window.updateUI();
    }
};
// [ui.js] 末尾添加

// 切换全屏模式的函数
export function toggleFullScreen() {
    // 尝试进入全屏
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`全屏启动失败: ${err.message}`);
        });
    } else {
        // 退出全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// 【关键】挂载到 window，否则 index.html 里的 onclick 找不到它
window.toggleFullScreen = toggleFullScreen;