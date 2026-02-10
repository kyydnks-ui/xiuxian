  // v0.28.1 数值平衡版：拉长炼气期，增加效率系数
export const REALMS = [
    // efficiency: 修炼效率加成。境界越高，吞吐灵气越快。
    { name: "凡人", min: 0, ap: 3, efficiency: 1.0 },
    
    // --- 炼气期 (目标：普通人30年左右修满) ---
    // 之前 min 是 50~500，现在扩大 6-7 倍
    { name: "炼气一层", min: 100, ap: 3, efficiency: 1.0 },
    { name: "炼气二层", min: 300, ap: 3, efficiency: 1.1 }, // 稍微快一点点
    { name: "炼气三层", min: 600, ap: 3, efficiency: 1.1 },
    { name: "炼气四层", min: 1000, ap: 3, efficiency: 1.2 },
    { name: "炼气五层", min: 1400, ap: 3, efficiency: 1.2 },
    { name: "炼气六层", min: 1800, ap: 3, efficiency: 1.3 },
    { name: "炼气七层", min: 2200, ap: 3, efficiency: 1.3 },
    { name: "炼气八层", min: 2600, ap: 3, efficiency: 1.4 },
    { name: "炼气九层", min: 3000, ap: 3, efficiency: 1.4 },
    // 瓶颈设在 3500，给玩家一点缓冲
    { name: "炼气圆满", min: 3500, ap: 3, efficiency: 1.5, isBottleneck: true }, 

    // --- 筑基期 (跨度拉大，效率提升) ---
    // 筑基寿元200岁，可以练100年
    { name: "筑基初期", min: 5000, ap: 4, efficiency: 2.0 }, // 效率翻倍
    { name: "筑基中期", min: 10000, ap: 4, efficiency: 2.2 },
    { name: "筑基后期", min: 18000, ap: 4, efficiency: 2.4 },
    { name: "筑基圆满", min: 25000, ap: 4, efficiency: 2.5, isBottleneck: true },

    // --- 金丹期 (开始数值膨胀) ---
    { name: "金丹初期", min: 50000, ap: 5, efficiency: 4.0 },
    { name: "金丹中期", min: 100000, ap: 5, efficiency: 4.5 },
    { name: "金丹后期", min: 180000, ap: 5, efficiency: 5.0 },
    { name: "金丹圆满", min: 300000, ap: 5, efficiency: 5.5, isBottleneck: true },

    // --- 元婴期 ---
    { name: "元婴初期", min: 500000, ap: 6, efficiency: 8.0 },
    { name: "元婴中期", min: 1000000, ap: 6, efficiency: 9.0 },
    { name: "元婴后期", min: 2000000, ap: 6, efficiency: 10.0 },
    { name: "元婴圆满", min: 3000000, ap: 6, efficiency: 12.0, isBottleneck: true, tribulation: 500000 },
    // --- 化神期 ---
    { name: "化神初期", min: 5000000, ap: 8, efficiency: 20.0 },
    { name: "化神中期", min: 10000000, ap: 8, efficiency: 25.0 },
    { name: "化神后期", min: 20000000, ap: 8, efficiency: 30.0 },
    { name: "化神圆满", min: 50000000, ap: 8, efficiency: 50.0, isBottleneck: true }
];

// 简单的寿命映射辅助函数 (为了不写几十行重复代码)
// 我们定义每个大境界的寿命，然后让小境界共享
const BASE_LIFES = {
    "凡人": 80,
    "炼气": 120,
    "筑基": 250,  // 筑基延寿更多
    "金丹": 500,
    "元婴": 1000,
    "化神": 2000
};

// 构造详细的寿命查找表
export const LIFE_CAPS = {};

// 自动生成：遍历 REALMS，根据名字前缀匹配寿命
REALMS.forEach(r => {
    let life = 80;
    if (r.name.includes("炼气")) life = BASE_LIFES["炼气"];
    else if (r.name.includes("筑基")) life = BASE_LIFES["筑基"];
    else if (r.name.includes("金丹")) life = BASE_LIFES["金丹"];
    else if (r.name.includes("元婴")) life = BASE_LIFES["元婴"];
    else if (r.name.includes("化神")) life = BASE_LIFES["化神"];
    
    LIFE_CAPS[r.name] = life;
});
// 单独补充凡人
LIFE_CAPS["凡人"] = 80;

export const DB = {
    surnames: ["南宫", "独孤", "叶", "萧", "林", "楚", "苏", "李", "王", "凤", "白", "顾", "沈", "纳兰", "欧阳", "慕容", "上官"],
    names_female: ["灵", "月", "瑶", "青", "雪", "婉", "凝", "紫", "嫣", "儿", "薇", "柔", "梦", "璃", "鸢", "锦", "霜", "露", "希", "幼"],
    names_male: ["尘", "风", "云", "傲", "天", "昊", "峰", "杰", "澜", "修", "墨", "言", "逍", "寒", "澈", "铮", "炎", "渊", "洛", "衡"],
    // ----------------------------
    // v0.24+ 名字生成词库池 (直接加在这里)
    // ----------------------------
    namePools: {
        surnames: {
            noble: ["南宫", "独孤", "纳兰", "慕容", "上官", "欧阳", "司空", "司徒", "端木", "公孙", "令狐", "东方"],
            common: ["叶", "萧", "林", "楚", "苏", "顾", "沈", "白", "凤", "李", "王", "秦", "唐", "陆", "温", "谢", "宋", "许"]
        },
        single: {
            female: ["灵", "月", "瑶", "青", "雪", "婉", "凝", "紫", "嫣", "薇", "柔", "梦", "璃", "鸢", "锦", "霜", "露", "希", "幼", "澜"],
            male:   ["尘", "风", "云", "傲", "天", "昊", "峰", "杰", "澜", "修", "墨", "言", "逍", "寒", "澈", "铮", "炎", "渊", "洛", "衡"]
        },
        twoParts: {
            prefix_f: ["清", "知", "若", "云", "霜", "月", "青", "灵", "微", "雪", "南", "栖", "疏", "映", "照", "听", "落", "辞"],
            suffix_f: ["寒", "微", "衣", "璃", "歌", "鸢", "珑", "影", "澜", "棠", "瑶", "霁", "岚", "蘅", "漪", "绾", "眠"],
            prefix_m: ["清", "玄", "云", "夜", "寒", "临", "逐", "归", "照", "闻", "惊", "凌", "承", "止", "问", "落", "辞", "不"],
            suffix_m: ["尘", "渊", "衡", "澈", "珩", "川", "霄", "舟", "然", "烬", "行", "言", "风", "雪", "鸣", "策", "城"]
        },
        fate: {
            female: ["惊鸿", "不归", "照影", "逐月", "临渊", "归尘", "无梦", "霁雪", "闻歌", "问心"],
            male:   ["无命", "夜行", "不归", "逐月", "临渊", "归尘", "问心", "照雪", "惊雷", "断岳"]
        },
        nickname: {prefix: ["小", "阿", "软", "糯", "幼", "团", "圆"],
            core_f: ["鸢", "霜", "月", "璃", "雪", "瑶", "澜", "棠"],
            core_m: ["洛", "衡", "尘", "澈", "渊", "舟", "言", "风"]
        }
    },
    items: [
        // --- 🆕 新增：狗血三件套 ---
        { name: "受孕丹", price: 200, effect: "buff_next_sure", desc: "下一次双修 100% 怀孕" },
        { name: "多子丸", price: 500, effect: "buff_next_multi", desc: "下一次怀孕必为多胞胎" },
        { name: "迷情香", price: 300, effect: "buff_charm", desc: "解锁【强行春宵】按钮" },
        // ---------------------------
        
        { name: "驻颜丹", effect: "charm+5", desc: "美容养颜，魅力大增", price: 100 }, // 补了个价格
        { name: "聚气丹", desc: "坊市常见的修炼丹药，服用后可大幅精进修为。", effect: "power", price: 50 },
        // ... (后面的物品保持不变，建议给它们也补上 price 属性，如果没有就默认为 0)
        { name: "极品灵石", effect: "power+50", desc: "蕴含纯净灵力", price: 1000 },
        { name: "传家玉佩", effect: "favor+10", desc: "普通的装饰品，送礼佳品", price: 20 },
        { name: "合欢散", effect: "love+5", desc: "江湖禁药，增加感情值", price: 80 },
        { name: "青云剑", effect: "power+20", desc: "一把锋利的宝剑", price: 500 },
        { name: "残缺秘籍", effect: "int+5", desc: "晦涩难懂的古籍", price: 50 },
        { name: "金钗", effect: "money+100", desc: "可以换钱", price: 100 },
        { name: "筑基丹", effect: "power+100", desc: "突破境界的宝药", price: 2000 },
        { name: "定颜珠", effect: "charm+10", desc: "传说能永葆青春的宝珠", price: 1000 }
    ],

    // grade: 0=灰(负面), 1=绿, 2=蓝, 3=紫, 4=金, 5=红
    traits: [
        // --- 红色/金色 (神话/传说) ---
        { name: "天凤血脉", grade: 5, type: "god", inheritChance: 0.3, buff: { power: 15, charm: 10 }, desc: "上古天凤遗脉苏醒。战力大幅提升，气场与魅力同样压制众生" },
        { name: "天煞孤星", grade: 5, type: "bad", inheritChance: 0.1, buff: { power: 20 }, desc: "孤煞命格加身。斩断羁绊的代价，换来极端爆发的战力增幅" },
        { name: "纯阴之体", grade: 4, type: "god", inheritChance: 0.2, buff: { charm: 15, power: 10 }, desc: "纯阴体魄，幽寒入骨。魅力极高，亦能在战斗中爆发阴性力量。" },
        { name: "纯阳之体", grade: 4, type: "god", inheritChance: 0.2, buff: { power: 15 }, desc: "纯阳之躯，烈火铸骨。以阳刚真炁强行推高战力上限" },
        { 
            name: "天道筑基", grade: 4, type: "god", 
            inheritChance: 0, // <--- 改为 0，禁止出生自带
            buff: { int: 10, charm: 10 }, 
            desc: "夺天地之造化，完美筑基。修炼速度大幅提升。" 
        },
        { 
            name: "一品金丹", grade: 5, type: "god", 
            inheritChance: 0, // <--- 改为 0
            buff: { power: 5000 }, 
            desc: "丹成一品，举世无双。同境界战力无敌，且潜力无限。" 
        },
        // --- 紫色 (史诗) ---
        { name: "倾国倾城", grade: 3, type: "good", inheritChance: 0.4, buff: { charm: 8 }, desc: "外貌与气质远超常人，魅力显著提升" },
        { name: "天生剑心", grade: 3, type: "good", inheritChance: 0.3, buff: { power: 8 }, desc: "剑心天成，剑道奇才，攻击力更高" },
        { name: "七窍玲珑", grade: 3, type: "good", inheritChance: 0.3, buff: { int: 8 }, desc: "心细如发，算无遗策，智力显著提升" },

        // --- 蓝色 (稀有) ---
        { name: "桃花泛滥", grade: 2, type: "neutral", inheritChance: 0.4, buff: { charm: 5 }, desc: "总是莫名其妙招惹异性，魅力提升" },
        { name: "坚韧不拔", grade: 2, type: "good", inheritChance: 0.4, buff: { power: 4 }, desc: "比常人更能吃苦，力量提升" },
        { name: "过目不忘", grade: 2, type: "good", inheritChance: 0.4, buff: { int: 4 }, desc: "记性很好，智力提升" },

        // --- 绿色 (普通) ---
        { name: "手脚麻利", grade: 1, type: "neutral", inheritChance: 0.5, buff: { power: 1 }, desc: "干活是一把好手，力量强于普通人" },
        { name: "声音好听", grade: 1, type: "good", inheritChance: 0.5, buff: { charm: 2 }, desc: "如珠落玉盘，魅力强于普通人" },
        { name: "贪吃", grade: 1, type: "neutral", inheritChance: 0.5, buff: {}, desc: "天生爱吃" },

        // --- 灰色 (负面) ---
        { name: "平庸", grade: 0, type: "bad", inheritChance: 0.2, buff: { power: -2 }, desc: "资质平平，难以成才" },
        { name: "经脉堵塞", grade: 0, type: "bad", inheritChance: 0.1, buff: { power: -5 }, desc: "修炼极慢，道途艰辛" },
        { name: "体弱多病", grade: 0, type: "bad", inheritChance: 0.2, buff: { power: -3 }, desc: "身体难以撑住高强度的折腾，" }
    ],

    // v0.23 外貌基因库（细化版）
    // [data.js] 替换 appearance 部分

    appearance: {
        // 1. 肤色 (决定滤镜)
        // [data.js]

        skins: [
         { val: "苍白", score: 5, filter: "brightness(0.75) sepia(0.65) hue-rotate(-35deg) saturate(0.6) contrast(1.7)" },
    
    // 2. 黄白 (#faf3eb)：极浅的暖调白
    { val: "奶白", score: 5, filter: "brightness(0.75) sepia(0.6) hue-rotate(-25deg) saturate(0.9) contrast(1.4)" },
    
    // 3. 粉一 (#ddc5c5)：也就是“粉调一白”，带点灰调的高级粉
    { val: "粉一白", score: 4, filter: "brightness(0.8) sepia(0.6) hue-rotate(-15deg) saturate(1.2) contrast(1.1)" },
    
    // 4. 黄一 (#e2c3b1)：也就是“黄调一白”，温暖的杏色
    { val: "黄一白", score: 3, filter: "brightness(0.75) sepia(0.45) hue-rotate(-10deg) saturate(1) contrast(1.7)" },
    
    // 5. 古铜 (#af9087)：健康的深色皮肤
    { val: "古铜色", score: 2, filter: "brightness(0.85) sepia(0.5) hue-rotate(-30deg) saturate(2) contrast(1)" }
        ],
        
        // 2. 脸型 (决定图片 ID)
        // 【注意】这里保留带 id 的版本！
        face_shapes: [
            { val: "瓜子脸", score: 5, id: "face_01" }, 
            { val: "鹅蛋脸", score: 4, id: "face_02" }, 
            { val: "圆脸", score: 3, id: "face_03" }, 
            { val: "方脸", score: 3, id: "face_04" }, 
            { val: "心形脸", score: 1, id: "face_05" }, 
            { val: "长脸", score: 5, id: "face_06" }, 
            { val: "国字脸", score: 4, id: "face_07" }, 
            { val: "菱形脸", score: 0, id: "face_08" }
        ],

        // 3. 头发颜色
        hair_colors: [
            { val: "烈焰红", score: 4, filter: "brightness(0.6) contrast(1.25) sepia(0.9) hue-rotate(-50deg) saturate(3.2) opacity(1)" },      // 原色(不用调)
            { val: "如墨",   score: 3, filter: "brightness(0.15) contrast(1) sepia(0.05) hue-rotate(-14deg) saturate(0.7) opacity(1)" }, // 黑 = 去色 + 变暗
            { val: "如雪",   score: 5, filter: "brightness(1.25) contrast(1.55) sepia(0.45) grayscale(1) hue-rotate(-180deg) saturate(5) opacity(1)" }, // 白 = 去色 + 提亮
            { val: "蓝色",   score: 2, filter: "brightness(1.05) contrast(1.15) sepia(0.5) hue-rotate(154deg) saturate(3.4) opacity(1)" }, // 棕色
            { val: "酒红",   score: 4, filter: "brightness(0.6) contrast(1.4) sepia(0.6) hue-rotate(-86deg) saturate(4.3) opacity(1)" }, 
            { val: "青丝",   score: 3, filter: "brightness(0.3) contrast(1.1) saturate(1) opacity(1)" }, // 深蓝黑
            { val: "栗色",   score: 3, filter: "brightness(0.45) contrast(1.3) sepia(0.95) hue-rotate(-22deg) saturate(3.3) opacity(1)" }
        ],

        hair_styles_female: [
            {val: "发型1", score: 5, frontId: "hair_f_front_01", backUpId: "hair_f_back_upper_01", backLowId: "hair_f_back_lower_01"},
    {
        val: "发型2",
        score: 5,
        frontId: null,  // 只有后发
        backUpId: "hair_f_back_upper_02",
        backLowId: "hair_f_back_lower_02"
    },
    {
        val: "发型3",
        score: 5,
        frontId: null,
        backUpId: "hair_f_back_upper_03",
        backLowId: "hair_f_back_lower_03"
    },
    {
        val: "发型4",
        score: 5,
        frontId: "hair_f_front_04",
        backUpId: "hair_f_back_upper_04",
        backLowId: "hair_f_back_lower_04"
    },
    {
        val: "发型5",
        score: 5,
        frontId: "hair_f_front_05",
        backUpId: "hair_f_back_upper_05",
        backLowId: "hair_f_back_lower_05"
    },
    {
        val: "发型6",
        score: 5,
        frontId: "hair_f_front_06",
        backUpId: "hair_f_back_upper_06",
        backLowId: null // 没有后发下层
    },
    {
        val: "发型7",
        score: 5,
        frontId: "hair_f_front_07",
        backUpId: "hair_f_back_upper_07",
        backLowId: "hair_f_back_lower_07"
    },
    {
        val: "发型8",
        score: 5,
        frontId: "hair_f_front_08",
        backUpId: "hair_f_back_upper_08",
        backLowId: "hair_f_back_lower_08"
    },
    {
        val: "发型9",
        score: 5,
        frontId: "hair_f_front_09",
        backUpId: "hair_f_back_upper_09",
        backLowId: "hair_f_back_lower_09"
    }
],

        // 2. 成年男性发型 (共6个)
        // 命名格式: hair_m_front_01...
        hair_styles_male: [
    {
        val: "男发1",
        score: 5,
        frontId: "hair_m_front_01",
        backUpId: "hair_m_back_upper_01",
        backLowId: "hair_m_back_lower_01"
    },
    {
        val: "男发2",
        score: 5,
        frontId: "hair_m_front_02",
        backUpId: "hair_m_back_upper_02",
        backLowId: null
    },
    {
        val: "男发3",
        score: 5,
        frontId: "hair_m_front_03",
        backUpId: "hair_m_back_upper_03",
        backLowId: null
    },
    {
        val: "男发4",
        score: 5,
        frontId: "hair_m_front_04",
        backUpId: "hair_m_back_upper_04",
        backLowId: null
    },
    {
        val: "男发5",
        score: 5,
        frontId: null,
        backUpId: "hair_m_back_upper_05",
        backLowId: null
    },
    {
        val: "男发6",
        score: 5,
        frontId: null,
        backUpId: "hair_m_back_upper_06",
        backLowId: "hair_m_back_lower_06"
    }
],

        eyes_female: [
            { val: "女眼1",  score: 3, socketId: "eye_f_01", pupilId: "eye_f_01_pupil" },
            { val: "女眼2",  score: 3, socketId: "eye_f_02", pupilId: "eye_f_02_pupil" },
            { val: "女眼3",  score: 3, socketId: "eye_f_03", pupilId: "eye_f_03_pupil" },
            { val: "女眼4",  score: 3, socketId: "eye_f_04", pupilId: "eye_f_04_pupil" },
            { val: "女眼5",  score: 3, socketId: "eye_f_05", pupilId: "eye_f_05_pupil" },
            { val: "女眼6",  score: 3, socketId: "eye_f_06", pupilId: "eye_f_06_pupil" },
            { val: "女眼7",  score: 3, socketId: "eye_f_07", pupilId: "eye_f_07_pupil" },
            { val: "女眼8",  score: 3, socketId: "eye_f_08", pupilId: "eye_f_08_pupil" },
            { val: "女眼9",  score: 3, socketId: "eye_f_09", pupilId: "eye_f_09_pupil" },
            { val: "女眼10", score: 3, socketId: "eye_f_10", pupilId: "eye_f_10_pupil" },
            { val: "女眼11", score: 3, socketId: "eye_f_11", pupilId: "eye_f_11_pupil" },
            { val: "女眼12", score: 3, socketId: "eye_f_12", pupilId: "eye_f_12_pupil" },
            { val: "女眼13", score: 3, socketId: "eye_f_13", pupilId: "eye_f_13_pupil" },
            { val: "女眼14", score: 3, socketId: "eye_f_14", pupilId: "eye_f_14_pupil" },
            { val: "女眼15", score: 3, socketId: "eye_f_15", pupilId: "eye_f_15_pupil" },
            { val: "女眼16", score: 3, socketId: "eye_f_16", pupilId: "eye_f_16_pupil" }
        ],

        // 2. 成年男性眼睛 (共11个)
        // ID命名规则: eye_m_01 ... eye_m_11
        eyes_male: [
            { val: "男眼1",  score: 3, socketId: "eye_m_01", pupilId: "eye_m_01_pupil" },
            { val: "男眼2",  score: 3, socketId: "eye_m_02", pupilId: "eye_m_02_pupil" },
            { val: "男眼3",  score: 3, socketId: "eye_m_03", pupilId: "eye_m_03_pupil" },
            { val: "男眼4",  score: 3, socketId: "eye_m_04", pupilId: "eye_m_04_pupil" },
            { val: "男眼5",  score: 3, socketId: "eye_m_05", pupilId: "eye_m_05_pupil" },
            { val: "男眼6",  score: 3, socketId: "eye_m_06", pupilId: "eye_m_06_pupil" },
            { val: "男眼7",  score: 3, socketId: "eye_m_07", pupilId: "eye_m_07_pupil" },
            { val: "男眼8",  score: 3, socketId: "eye_m_08", pupilId: "eye_m_08_pupil" },
            { val: "男眼9",  score: 3, socketId: "eye_m_09", pupilId: "eye_m_09_pupil" },
            { val: "男眼10", score: 3, socketId: "eye_m_10", pupilId: "eye_m_10_pupil" },
            { val: "男眼11", score: 3, socketId: "eye_m_11", pupilId: "eye_m_11_pupil" }
        ],

        eye_colors: [
            // 假设眼球素材是亮灰色的 (#eeeeee 或类似)
            // 1. 琥珀色 (金黄)
            { val: "琥珀色", score: 4, filter: "sepia(1) hue-rotate(10deg) saturate(3) brightness(1.2) contrast(1.1)" },
            
            // 2. 深渊黑 (压暗)
            { val: "深渊黑", score: 3, filter: "grayscale(1) brightness(0.3) contrast(1.2)" },
            
            // 3. 琉璃紫 (紫色)
            { val: "琉璃紫", score: 5, filter: "sepia(1) hue-rotate(240deg) saturate(2.5) brightness(0.9)" },
            
            // 4. 碧绿 (绿色)
            { val: "碧绿", score: 4, filter: "sepia(1) hue-rotate(60deg) saturate(2.5) brightness(1.0)" },
            
            // 5. 星空蓝 (蓝色)
            { val: "星空蓝", score: 5, filter: "sepia(1) hue-rotate(180deg) saturate(3) brightness(1.1)" },
            
            // 6. 赤红 (红色)
            { val: "赤红", score: 2, filter: "sepia(1) hue-rotate(-50deg) saturate(4) brightness(0.9)" },
            
            // 7. 浅灰 (原色/银色)
            { val: "浅灰", score: 2, filter: "grayscale(1) brightness(1.1) contrast(1.0)" }
        ],
        // 1. 成年女性眉毛 (共29个)
        eyebrows_female: [
            { val: "女眉1", id: "brow_f_01", score: 3 }, { val: "女眉2", id: "brow_f_02", score: 3 },
            { val: "女眉3", id: "brow_f_03", score: 3 }, { val: "女眉4", id: "brow_f_04", score: 3 },
            { val: "女眉5", id: "brow_f_05", score: 3 }, { val: "女眉6", id: "brow_f_06", score: 3 },
            { val: "女眉7", id: "brow_f_07", score: 3 }, { val: "女眉8", id: "brow_f_08", score: 3 },
            { val: "女眉9", id: "brow_f_09", score: 3 }, { val: "女眉10", id: "brow_f_10", score: 3 },
            { val: "女眉11", id: "brow_f_11", score: 3 }, { val: "女眉12", id: "brow_f_12", score: 3 },
            { val: "女眉13", id: "brow_f_13", score: 3 }, { val: "女眉14", id: "brow_f_14", score: 3 },
            { val: "女眉15", id: "brow_f_15", score: 3 }, { val: "女眉16", id: "brow_f_16", score: 3 },
            { val: "女眉17", id: "brow_f_17", score: 3 }, { val: "女眉18", id: "brow_f_18", score: 3 },
            { val: "女眉19", id: "brow_f_19", score: 3 }, { val: "女眉20", id: "brow_f_20", score: 3 },
            { val: "女眉21", id: "brow_f_21", score: 3 }, { val: "女眉22", id: "brow_f_22", score: 3 },
            { val: "女眉23", id: "brow_f_23", score: 3 }, { val: "女眉24", id: "brow_f_24", score: 3 },
            { val: "女眉25", id: "brow_f_25", score: 3 }, { val: "女眉26", id: "brow_f_26", score: 3 },
            { val: "女眉27", id: "brow_f_27", score: 3 }, { val: "女眉28", id: "brow_f_28", score: 3 },
            { val: "女眉29", id: "brow_f_29", score: 3 }
        ],

        // 2. 成年男性眉毛 (共24个)
        eyebrows_male: [
            { val: "男眉1", id: "brow_m_01", score: 3 }, { val: "男眉2", id: "brow_m_02", score: 3 },
            { val: "男眉3", id: "brow_m_03", score: 3 }, { val: "男眉4", id: "brow_m_04", score: 3 },
            { val: "男眉5", id: "brow_m_05", score: 3 }, { val: "男眉6", id: "brow_m_06", score: 3 },
            { val: "男眉7", id: "brow_m_07", score: 3 }, { val: "男眉8", id: "brow_m_08", score: 3 },
            { val: "男眉9", id: "brow_m_09", score: 3 }, { val: "男眉10", id: "brow_m_10", score: 3 },
            { val: "男眉11", id: "brow_m_11", score: 3 }, { val: "男眉12", id: "brow_m_12", score: 3 },
            { val: "男眉13", id: "brow_m_13", score: 3 }, { val: "男眉14", id: "brow_m_14", score: 3 },
            { val: "男眉15", id: "brow_m_15", score: 3 }, { val: "男眉16", id: "brow_m_16", score: 3 },
            { val: "男眉17", id: "brow_m_17", score: 3 }, { val: "男眉18", id: "brow_m_18", score: 3 },
            { val: "男眉19", id: "brow_m_19", score: 3 }, { val: "男眉20", id: "brow_m_20", score: 3 },
            { val: "男眉21", id: "brow_m_21", score: 3 }, { val: "男眉22", id: "brow_m_22", score: 3 },
            { val: "男眉23", id: "brow_m_23", score: 3 }, { val: "男眉24", id: "brow_m_24", score: 3 }
        ],

        // 7. 鼻子 (暂时没图，先不加ID)
        noses: [
            { val: "挺拔鼻梁", score: 4 }, { val: "秀气小鼻", score: 4 }, { val: "鹰钩鼻", score: 2 }, 
            { val: "悬胆鼻", score: 3 }, { val: "蒜头鼻", score: 0 }
        ],

        // 8. 嘴巴 
        lips: [
            { val: "薄唇",     score: 3, id: "lip_01" }, 
            { val: "M字唇",    score: 5, id: "lip_02" }, 
            { val: "樱桃小口", score: 4, id: "lip_03" }, 
            { val: "厚唇",     score: 2, id: "lip_04" }, 
            { val: "微笑唇",   score: 4, id: "lip_05" },
            { val: "唇",   score: 4, id: "lip_06" }
        ],

        // 9. 装饰
        decorations: [
            { val: "眼角泪痣", score: 5 }, { val: "眉间朱砂", score: 5 }, { val: "脸颊酒窝", score: 3 }, 
            { val: "英气剑眉", score: 3 }, { val: "断眉", score: 1 }, { val: "无", score: 0 }
        ],

        // 10. 气质
        temperaments: [
            { val: "清冷", score: 4 }, { val: "妩媚", score: 4 }, { val: "英气", score: 4 }, 
            { val: "温柔", score: 3 }, { val: "阴郁", score: 1 }, { val: "阳光", score: 3 },
            { val: "威严", score: 2 }, { val: "猥琐", score: -5 }
        ]
    }
};
export const PERSONAS = {
    TRICKSTER: { 
        name: "疏狂", 
        desc: "玩世不恭，视规则如无物，是个乐子人。",
        params: { favorRate: 1.3, loveRate: 0.7, darkBase: 0, darkTrigger: 0.4 },
        stats_ranges: { moral: [10, 90], devotion: [0, 80], desire: [20, 100] }
    },
    YOUTH: { 
        name: "骄阳", 
        desc: "如正午烈日，坦荡热烈，纯情执拗。",
        params: { favorRate: 1.2, loveRate: 1.2, darkBase: 0, darkTrigger: 0.3 },
        stats_ranges: { moral: [20, 100], devotion: [20, 100], desire: [0, 100] }
    },
    NOBLE: { 
        name: "清贵", 
        desc: "矜贵自信，知世故而不世故，高岭之花。",
        params: { favorRate: 0.8, loveRate: 0.8, darkBase: 5, darkTrigger: 0.6 },
        stats_ranges: { moral: [30, 100], devotion: [0, 100], desire: [0, 90] }
    },
    ASCETIC: { 
        name: "守心", 
        desc: "心中唯道，不近女色，禁欲克制。",
        params: { favorRate: 0.7, loveRate: 0.3, darkBase: 0, darkTrigger: 0.2 },
        stats_ranges: { moral: [50, 100], devotion: [0, 100], desire: [0, 50] }
    },
    PRAGMATIST: { 
        name: "市侩", 
        desc: "功利现实，精致利己，无利不起早。",
        params: { favorRate: 1.5, loveRate: 0.4, darkBase: 10, darkTrigger: 1.2 },
       stats_ranges: { moral: [0, 100], devotion: [0, 100], desire: [30, 100] }
    },
    LONER: { 
        name: "孤绝", 
        desc: "人狠话少，生人勿近，独来独往。",
        params: { favorRate: 0.5, loveRate: 0.6, darkBase: 10, darkTrigger: 0.8 },
        stats_ranges: { moral: [0, 100], devotion: [0, 70], desire: [0, 100] }
    },
    GENTLE: { 
        name: "温润", 
        desc: "温柔包容，如沐春风，老好人。",
        params: { favorRate: 1.1, loveRate: 0.9, darkBase: 0, darkTrigger: 0.5 },
       stats_ranges: { moral: [20, 100], devotion: [0, 100], desire: [0, 100] }
    },
    MANIC: { 
        name: "痴绝", 
        desc: "执念深重，偏执疯魔，爱恨极端。",
        params: { favorRate: 1.0, loveRate: 2.0, darkBase: 30, darkTrigger: 3.0 },
        isCrazy: true,
        stats_ranges: { moral: [0, 80], devotion: [50, 100], desire: [0, 100] }
    },
    // 【新增】儿童专用占位性格
    CHILD: {
        name: "懵懂",
        desc: "尚在垂髫之年，心性未定，犹如一张白纸。",
        params: { favorRate: 1.0, loveRate: 1.0, darkBase: 0, darkTrigger: 0 },
        stats_ranges: { moral: [40, 60], devotion: [40, 60], desire: [40, 60] }
    }
};

export const DAOS = {
    SEEKER:   { id: "seeker",   name: "求道者", desc: "大道 > 情感" },
    HUMANIST: { id: "humanist", name: "入世者", desc: "情感 > 大道" },
    REALIST:  { id: "realist",  name: "唯我者", desc: "生存 > 一切" }
};

export const PERSONA_KEYS = Object.keys(PERSONAS).filter(k => k !== 'CHILD');
export const DAO_KEYS = Object.keys(DAOS);
export const PERSONA_CATEGORIES = {
    GOOD: {
        keys: ['YOUTH', 'GENTLE', 'ASCETIC'], // 骄阳, 温润, 守心
        weight: 0.35,
        name: "善"
    },
    NEUTRAL: {
        keys: ['NOBLE', 'TRICKSTER', 'LONER'], // 清贵, 疏狂, 孤绝
        weight: 0.40,
        name: "中"
    },
    EVIL: {
        keys: ['PRAGMATIST', 'MANIC'], // 市侩, 痴绝
        weight: 0.25,
        name: "恶"
    }
};
// data.js 最底部

// data.js

// data.js

// data.js

export const FIXED_WORLD_CONFIG = {
    leaders: [
        { 
            key: 'XUAN_JI', name: "玄机仙子", gender: "女", pKey: "ASCETIC", power: 50000, sect: "sect", location: "sect",
            bloodlinePurity: 15,rank: "master",
            // 设定：奶白皮、鹅蛋脸、白发、女眼5、星空蓝瞳、清冷、薄唇、女眉5
            app: { skins: 1,
    face_shapes: 7,
    hair_styles: 0,
    hair_colors: 2,
    eyes: 0,
    eye_colors: 4,
    eyebrows: 5,
    lips: 4,
    noses: 0,
    decorations: 5,
    temperaments: 0 } 
        },
        { 
            key: 'SHEN_LADY', name: "沈光行", gender: "女", pKey: "NOBLE", sect: "shen_family", location: "shen_family",
            bloodlinePurity: 15, power: 50050, rank: "master",
            // 设定：苍白皮、瓜子脸、白发、女眼13、赤红瞳、威严、M字唇、女眉10
            app: { 
    skins: 0,
    face_shapes: 6,
    hair_styles: 4,
    hair_colors: 2,
    eyes: 6,
    eye_colors: 5,
    eyebrows: 2,
    lips: 0,
    noses: 0,
    decorations: 3,
    temperaments: 6
}  
        },
        { 
            // === 新增：丹鼎阁主 ===
            key: 'DAN_MASTER',           // 唯一标识符
            name: "叶灵枢",               // 名字
            gender: "男",                // 性别
            pKey: "PRAGMATIST",          // 性格：市侩 (Pragmatist) - 符合"不见兔子不撒鹰"的设定
            sect: "dan_ding",            // 门派ID (注意必须是 dan_ding)
            location: "dan_ding",        // 初始位置
            bloodlinePurity: 15,         // 血脉浓度
            power: 51000,                // 战力 (化神初期左右)
            rank: "master",
            // 外貌设定：眯眯眼、精明的面相
            app: { 
                skins: 3,                // 黄一白
                face_shapes: 6,          // 长脸
                hair_styles: 0,          // 束发
                hair_colors: 1,          // 黑色
                eyes: 3,                 // 男眼4 (假设是某种细长眼)
                eye_colors: 0,           // 琥珀色瞳孔 (像金钱的颜色)
                eyebrows: 14,            // 某种眉毛
                lips: 0,                 // 薄唇
                noses: 2,                // 鹰钩鼻 (面相学里比较精明)
                decorations: 5,          // 无特殊装饰
                temperaments: 6          // 威严/阴郁
            },
            // 专属履历 (可选，增加沉浸感)
            story: "丹鼎阁现任阁主，一手炼丹术出神入化，但为人极其现实，奉行“等价交换”原则，没有足够的筹码休想请他出手。"
        },
        { 
            key: 'MO_PA', name: "莫问", gender: "男", pKey: "ASCETIC", sect: "mo_family", location: "mo_family",
            bloodlinePurity: 15, power: 45000, rank: "master", hasPrimalYang: false,
            // 设定：黄一白、国字脸、黑发、男眼5、深渊黑瞳、威严、薄唇、男眉5
            app: { skins: 3,
    face_shapes: 6,
    hair_styles: 0,
    hair_colors: 5,
    eyes: 1,
    eye_colors: 1,
    eyebrows: 14,
    lips: 0,
    noses: 0,
    decorations: 5,
    temperaments: 6 } 
        },
        { 
            key: 'SU_JT', name: "苏竞天", gender: "女", pKey: "TRICKSTER", sect: "he_huan", location: "he_huan",
            bloodlinePurity: 15, power: 50800, rank: "master",
            // 设定：粉一白、鹅蛋脸、红发、女眼3、琉璃紫瞳、妩媚、微笑唇、女眉15
            app: { skins: 2,
    face_shapes: 6,
    hair_styles: 1,
    hair_colors: 0,
    eyes: 14,
    eye_colors: 2,
    eyebrows: 5,
    lips: 2,
    noses: 0,
    decorations: 2,
    temperaments: 1 } 
        },
        { 
            key: 'LU_ZF', name: "陆斩风", gender: "男", pKey: "LONER", sect: "wan_jian", location: "wan_jian",
            bloodlinePurity: 15, power: 50600, rank: "master",
            // 设定：古铜色、方脸、黑发、男眼2、深渊黑瞳、英气、唇、男眉1
            app: { skins: 4,
    face_shapes: 6,
    hair_colors: 1,
    hair_styles: 1,
    eyes: 1,
    eye_colors: 1,
    eyebrows: 3,
    lips: 1,
    noses: 0,
    decorations: 4,
    temperaments: 2 } 
        }
    ],
    partners: [
        { 
            key: 'SHEN_PA', name: "沈叙", gender: "男", pKey: "GENTLE", sect: "shen_family", location: "shen_family", spouseKey: 'SHEN_LADY',
            bloodlinePurity: 15, power: 40000, hasPrimalYang: false,
            app: { skins: 0,
    face_shapes: 3,
    hair_styles: 2,
    hair_colors: 0,
    eyes: 9,
    eye_colors: 2,
    eyebrows: 20,
    lips: 0,
    noses: 0,
    decorations: 1,
    temperaments: 1}
        },
        { 
            key: 'LIU_YING', name: "柳英", gender: "女", pKey: "GENTLE", sect: "mo_family", location: "mo_family", spouseKey: 'MO_PA',
            bloodlinePurity: 15, power: 42000,
            app: { skins: 1,
    face_shapes: 2,
    hair_styles: 0,
    hair_colors: 1,
    eyes: 2,
    eye_colors: 6,
    eyebrows: 6,
    lips: 1,
    noses: 1,
    decorations: 2,
    temperaments: 3 }
        },
        { 
            key: 'JIAN_XIN', name: "剑心", gender: "女", pKey: "ASCETIC", sect: "wan_jian", location: "wan_jian", spouseKey: 'LU_ZF',
            bloodlinePurity: 15, power: 50000,
            app: { skins: 0,
    face_shapes: 2,
    hair_shapes: 6,
    hair_colors: 2,
    eyes: 1,
    eye_colors: 6,
    eyebrows: 15,
    lips: 0,
    noses: 0,
    decorations: 1,
    temperaments: 2 }
        },
        { 
            key: 'GUIDE_BRO', name: null, gender: "男", pKey: "GENTLE", sect: "sect", location: "sect",
            bloodlinePurity: 3, power: 5000,
            favor: 30, // 初始就有好感，方便新手求助
            }
    ],
    children: [
        { 
            key: 'SHEN QING', name: "沈青", gender: "女", age: 18, pKey: "NOBLE", sect: "shen_family", location: "shen_family", fKey: 'SHEN_PA', mKey: 'SHEN_LADY',
            bloodlinePurity: 15, power: 25000,
            app: {
    skins: 1,
    face_shapes: 2,
    hair_styles: 5,
    hair_colors: 0,
    eyes: 0,
    eye_colors: 5,
    eyebrows: 14,
    lips: 0,
    noses: 3,
    decorations: 3,
    temperaments: 2
}
        },
        { 
            key: 'MO_LI', name: "莫离", gender: "男", age: 16, pKey: "GENTLE", sect: "mo_family", location: "sect", fKey: 'MO_PA', mKey: 'LIU_YING', favor: 80, love: 45,
            bloodlinePurity: 15, power: 1000,
            app: { 
    skins: 1,
    face_shapes: 3,
    hair_styles: 2,
    hair_colors: 5,
    eyes: 1,
    eye_colors: 1,
    eyebrows: 19,
    lips: 3,
    noses: 0,
    decorations: 0,
    temperaments: 5
}
        },
        { 
           key: 'MO_NIAN', name: "苏念", gender: "男", age: 10, pKey: "CHILD", sect: "he_huan", location: "he_huan", mKey: 'SU_JT',
            bloodlinePurity: 15,
            app: { skins: 2, face_shapes: 2, hair_colors: 0, hair_styles: 1, eyes: 3, eye_colors: 3, temperaments: 5, lips: 4, eyebrows: 0 }
        }
    ]
};
// 男性特殊特征词库
// --- 男性生殖特征大师级词库 (全员强力版) ---
export const MALE_GENITAL_LIB = {
    // 尺寸与比例：取消弱小词汇，强调不同的“巨”
    size: [
        "粗长骇人", "修长匀称且分量十足", "粗壮凶猛如重炮", 
        "比例夸张的巨物", "犹如婴儿手臂般粗壮", "由于过分巨大而显得沉重", 
        "比例惊人的狰狞巨根", "极具存在感的硕大肉刃", "修长且顶端肥厚的异物"
    ],
    // 勃起与硬度：强调动态的张力
    hardness: [
        "坚如磐石且铁硬", "滚烫发硬且脉动明显", "充血肿胀至极限", 
        "极度敏感一碰即硬", "由于过度胀大而发紫发热", "直挺挺指向天空的狂态",
        "青筋虬结地剧烈跳动"
    ],
    // 龟头细节：参考你提供的细腻格式
    glans: {
        shape: ["硕大的伞状蘑菇头", "棱角分明的箭头型", "圆润肥厚的伞沿", "马眼外翻如花蕾", "硕大如拳的顶端"],
        color: ["呈鲜艳的粉红色", "呈现深紫红色", "紫红发亮", "枣红色", "充血后色泽愈深"],
        feature: ["完全暴露且湿润", "冠状沟深而明显", "马眼渗出大量透明液体", "系带处充血肿胀且极度敏感", "包皮彻底翻开露出湿润内侧"]
    },
    // 茎身特征：强调质感与视觉冲击
    shaft: [
        "青筋暴起盘根错节", "表面光滑细腻如绸", "布满凸起血管如虬龙", "略微自然上翘的弧度", 
        "由于开发过度而布满暧昧红痕", "柱身颗粒感明显", "笔直凶猛且极具侵略性"
    ],
    // 阴囊特征：增加沉重感与雄性气味
    scrotum: [
        "沉甸甸地垂着且硕大", "紧实且随着动作晃动", "皱褶明显且滚烫发热", 
        "布满浓密汗液", "散发着浓烈的雄性麝香味", "包裹着两颗硕大实感"
    ],
    // 射精表现
    fluid: [
        "射程极远且有力", "量大浓稠地灌满", "清稀透明且先走液极多", "喷射有力且滚烫", 
        "腥甜且带着浓郁情欲味", "伴随着痉挛倾泻而出"
    ]
};

// --- 胸部特征词库 (同步优化) ---
export const CHEST_LIB = {
    type: ["宽阔厚实", "清瘦挺拔但胸肌轮廓深邃", "肌肉发达且充满张力", "倒三角比例完美", "肩膀宽阔胸肌鼓胀", "充满爆发力的兽感"],
    muscle: ["坚硬如岩石", "紧实有弹性", "柔韧有肉感", "随着呼吸剧烈起伏", "胸肌沟壑分明且深邃"],
    skin: ["健康小麦色", "冷白细腻", "古铜色汗湿反光", "布满战斗与情欲的痕迹", "泛着诱人的油光", "白皙近乎透明且透着青色血管"],
    nipple: ["淡粉色且挺翘", "深褐色硬挺如豆", "充血肿胀且高度敏感", "小巧粉嫩", "由于刺激而变硬发红", "晕染极开且诱人"],
    hair: ["光洁无毛如玉", "浓密黑卷充满雄性气息", "稀疏的绒毛感", "仅乳晕处有性感薄毛", "胸沟处沾着汗水的薄毛"]
};