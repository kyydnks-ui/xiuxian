if (success) {
            // ==========================================
            // 1. 数值结算层 (绝对优先，确保 UI 刷新)
            // ==========================================
            let exp = 50 + (person.power * 0.01) + (p.charm * 2);
            
            // 心魔加成逻辑 (R18)
            if (p.buffs && p.buffs.xin_mo_yu) {
                let bonus = Math.floor(exp * 0.5);
                exp += bonus;
                addLog(`【心魔欢愉】体内的欲念疯狂吞噬着交合产生的元气！(修为额外 +${bonus})`, "#e91e63");
            }
            
            let r18Bonus = { expRate: 1.0, desc: [] };
            if (window.R18 && window.R18.getTraitBonus) {
                r18Bonus = window.R18.getTraitBonus(person);
            }

            if (r18Bonus.expRate > 1.0) {
                exp = Math.floor(exp * r18Bonus.expRate);
            }

            // 最终结算与强制刷新
            let finalVal = Math.floor(exp);
            p.power += finalVal;
            if (p.maxPower !== undefined && p.power > p.maxPower) p.maxPower = p.power;
            if (window.gameState && window.gameState.player) window.gameState.player.power = p.power;
            
            // 立即刷新屏幕数字
            if (typeof updateUI === 'function') updateUI();
            else if (typeof window.updateUI === 'function') window.updateUI();

            // ==========================================
            // 2. 日志 A：修为报告 (第一条：绿色)
            // ==========================================
            let r18LogText = r18Bonus.expRate > 1.0 ? `<br><span style="color:#e67e22; font-size:12px;">🔥 [肉体加成] 由于【${r18Bonus.desc.join(", ")}】，修炼效率大幅提升！(x${r18Bonus.expRate.toFixed(1)})</span>` : "";
            addLog(`【双修】阴阳调和，你的修为增加了 ${finalVal} 点。${r18LogText}`, "#2ecc71");

            // ==========================================
            // 3. 药效与特殊台词层 (第二条：金色/粉色)
            // ==========================================
            // 药效判定
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
                // 多子丸预告
                if (p.buffs && p.buffs.next_multi) addLog("【药效预告】多子丸正在发挥效力...", "#e91e63");
            }

            // 特殊台词 (红帐落下)
            let specialText = Text.getSpecialDialogue ? Text.getSpecialDialogue(person, "romance") : null;
            if (specialText) {
                addLog(`红帐落下。[${linkName(person)}] ${specialText}`, "#e91e63");
            } else {
                addLog(`${Text.Dialogue.getWoohoo(person, isSpouse, gameState.spouseId, false)}`, "#e91e63");
            }

            // ==========================================
            // 4. 日志 B：R18 交互大合集 (剧情+特写)
            // ==========================================
            if (gameState.settings.enableR18) {
                // (1) 长剧情卡片
                let fullScene = "";
                if (window.R18 && window.R18.generatePaPaLog) {
                    fullScene = window.R18.generatePaPaLog(person, 'gentle');
                } else {
                    fullScene = "屋内春色无边，两人气息渐粗...";
                }
                addLog(`<div style="padding:8px; border-left:3px solid #e91e63; background:rgba(233,30,99,0.05); margin:5px 0; color:#444; font-size:14px;">${fullScene}</div>`);

                // (2) 旧的原版 R18 日志
                const oldLog = Text.Dialogue.getR18Log(person); 
                if (oldLog) addLog(`[秘] ${oldLog}`, "#800000");

                // (3) 动态部位特写
                if (window.R18 && window.R18.getDynamicSexLog) {
                    const dynamicLog = window.R18.getDynamicSexLog(person, 'gentle');
                    if (dynamicLog) addLog(dynamicLog, "#e91e63"); 
                }

                // (4) 元阳与部位开发
                if (window.R18) {
                    let yangResult = window.R18.checkPrimalYang(person);
                    if (yangResult.success) addLog(yangResult.msg, "#e67e22");
                    let devMsg = window.R18.developBody(person, 1); 
                    if (devMsg) addLog(`[身体变化] ${devMsg}`, "#e91e63");
                }
            }

            // ==========================================
            // 5. 结尾层 (情感、履历)
            // ==========================================
            p.lastLoverId = person.id;
            changeEmotion(person, 'favor', cfg.SUCCESS_FAVOR_GAIN);
            changeEmotion(person, 'love', cfg.SUCCESS_LOVE_GAIN);

            History.record(person, 'love', `与 [${p.name}] 共度良宵。`);
            History.record(p, 'love', `与 [${person.name}] 缠绵悱恻。`);
        }