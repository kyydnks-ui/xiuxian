// history.js
// NPC 生平履历系统 (完整升级版)

import { gameState } from './state.js';
import { getDisplayTime } from './utils.js'; 

export const History = {
    // 核心：记录一条历史
    record: function(person, type, desc) {
        if (!person) return;
        
        // 1. 确保有 history 数组
        if (!person.history) person.history = [];

        // 2. 构造记录条目
        const entry = {
            year: Math.ceil(gameState.totalMonths / 12),
            month: (gameState.totalMonths - 1) % 12 + 1,
            timeStr: getDisplayTime(), 
            type: type,
            msg: desc 
        };

        // 3. 插入头部
        person.history.unshift(entry);

        // 4. 限制长度
        if (person.history.length > 100) {
            person.history.pop();
        }
    },

    // 辅助：生成 HTML 供 UI 显示
    render: function(person) {
        // --- 【新增逻辑】真魂传按钮 (仅玩家可见) ---
        // 这一段是你原本文件里没有的，必须加上！
        let soulButtonHtml = "";
        
        // 只有当“查看的人”是“当前玩家”时，才显示这个按钮
        // 夺舍后，gameState.player 变了，这个按钮会自动跑到新身体的履历里
        if (person.id === gameState.player.id) {
            soulButtonHtml = `
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; text-align: center;">
                    <button class="btn" style="background: linear-gradient(135deg, #8e44ad, #9b59b6); color: white; width: 90%; font-weight: bold; box-shadow: 0 4px 6px rgba(142, 68, 173, 0.3);"
                        onmouseover="window.playSound('hover')" 
                        onclick="window.openSoulHistory(); event.stopPropagation();">
                        📜 查看真魂传 (家族底蕴)
                    </button>
                    <div style="font-size: 10px; color: #999; margin-top: 5px;">
                        当前第 <span style="color:#8e44ad; font-weight:bold;">${gameState.generation || 1}</span> 代夺舍身
                    </div>
                </div>
            `;
        }
        // ---------------------------------------

        // 如果没有履历，显示默认空状态
        if (!person.history || person.history.length === 0) {
            // 这里也要把按钮加上，否则刚出生没履历时看不到按钮
            return `
                ${soulButtonHtml} 
                <div style="text-align:center; color:#ccc; padding:20px; font-style:italic; font-size:12px;">
                    - 此人尚未留下任何传说 -
                </div>`;
        }

        // 把按钮拼接到列表最前面
        let html = `${soulButtonHtml}<ul class="history-list" style="list-style:none; padding:0; margin:0;">`;
        
        person.history.forEach(h => {
            // 1. 图标与颜色映射
            let icon = "📝";
            let color = "#555";
            if (h.type === 'battle') { icon = "⚔️"; color = "#c0392b"; } 
            if (h.type === 'love') { icon = "❤"; color = "#e91e63"; }    
            if (h.type === 'breakthrough') { icon = "⚡"; color = "#f39c12"; } 
            if (h.type === 'life') { icon = "🕯️"; color = "#2c3e50"; }   
            if (h.type === 'social') { icon = "💬"; color = "#27ae60"; }  
            
            let message = h.msg || h.desc || "无描述";
            let dateDisplay = h.timeStr || `第${h.year}年${h.month}月`;

            // 2. 超链接转换
            let processedMsg = message.replace(/\[(.*?)\]/g, (match, name) => {
                return `<strong 
                    style="color:#2980b9; cursor:pointer; font-weight:bold; margin:0 2px;" 
                    onmouseover="this.style.textDecoration='underline'"
                    onmouseout="this.style.textDecoration='none'"
                    onclick="if(window.openDetailByName) { window.openDetailByName('${name}'); event.stopPropagation(); } else { console.error('openDetailByName 未定义'); }"
                    title="点击查看 ${name} 的详情"
                >${name}</strong>`;
            });

            // 3. 生成 HTML 行
            html += `
                <li style="margin-bottom:10px; line-height:1.5; border-bottom:1px dashed #eee; padding-bottom:8px; display:flex; align-items:start;">
                    <span style="margin-right:8px; font-size:16px;">${icon}</span> 
                    <div style="flex:1;">
                        <div style="color:#999; font-size:11px; margin-bottom:2px;">${dateDisplay}</div>
                        <div style="color:${color}; font-size:13px;">${processedMsg}</div>
                    </div>
                </li>`;
        });
        
        html += '</ul>';
        return html;
    }
};