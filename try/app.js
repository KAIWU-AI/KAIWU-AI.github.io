const PRESETS = [
  {
    id: "models",
    keywords: ["模型", "扩散", "ai", "人工智能"],
    title: "大模型与扩散模型：两种生成方式",
    video: "../assets/videos/brainstorm-avatar-card.mp4",
    poster: "../assets/videos/brainstorm-avatar-card-poster.jpg",
    scenes: [
      ["提出问题", "用日常创作任务引出“理解语言”与“生成画面”的差异。", "数字人"],
      ["拆解原理", "以词元轨迹和逐步去噪动画解释两类模型的核心机制。", "动态图解"],
      ["对照应用", "在同一创作任务中并列展示文本规划与视觉生成。", "分屏场景"],
    ],
  },
  {
    id: "solar",
    keywords: ["太阳", "行星", "宇宙", "天文"],
    title: "太阳系运行：从轨道到行星周期",
    video: "../assets/videos/brainstorm-female-teacher-card.mp4",
    poster: "../assets/videos/brainstorm-female-teacher-card-poster.jpg",
    scenes: [
      ["建立尺度", "从太阳向外展开八大行星，说明画面采用压缩比例。", "3D 场景"],
      ["观察轨道", "切换俯视与侧视镜头，对比轨道半径与倾角。", "轨道动画"],
      ["理解周期", "通过速度与公转周期的对照，解释近快远慢。", "数据图解"],
    ],
  },
  {
    id: "physics",
    keywords: ["牛顿", "力", "加速度", "物理"],
    title: "牛顿第二定律：力如何改变运动",
    video: "../assets/videos/brainstorm-teacher-card.mp4",
    poster: "../assets/videos/brainstorm-teacher-card-poster.jpg",
    scenes: [
      ["生活引入", "比较推动空车与满载购物车时的直观感受。", "情境演示"],
      ["变量实验", "固定质量改变推力，再固定推力改变质量。", "虚拟实验"],
      ["归纳公式", "让数据曲线逐步汇聚到 F = ma 的关系。", "动态图表"],
    ],
  },
];

const DEFAULT_PRESET = {
  id: "custom",
  title: "从核心问题到可视化讲解",
  video: "../assets/videos/brainstorm-female-teacher-card.mp4",
  poster: "../assets/videos/brainstorm-female-teacher-card-poster.jpg",
  scenes: [
    ["建立问题", "从学习者熟悉的现象出发，明确本节课要回答的核心问题。", "数字人"],
    ["解释关键", "把主要概念拆成三个层次，并为每层匹配直观视觉表达。", "动态图解"],
    ["应用总结", "通过一个应用案例完成知识迁移并回顾关键结论。", "综合场景"],
  ],
};

const PHASES = [
  ["understand", "正在提炼教学目标", 24],
  ["structure", "正在组织讲解结构", 49],
  ["visual", "正在匹配视觉场景", 76],
  ["compose", "正在合成体验方案", 100],
];

export function normalizeTopic(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function selectPreset(topic) {
  const normalized = normalizeTopic(topic).toLocaleLowerCase("zh-CN");
  return PRESETS.find((preset) => preset.keywords.some((keyword) => normalized.includes(keyword))) ?? DEFAULT_PRESET;
}

export function buildDemoPlan(topic) {
  const normalized = normalizeTopic(topic);
  const preset = selectPreset(normalized);
  return {
    topic: normalized,
    title: preset.id === "custom" ? `${normalized}：可视化课程方案` : preset.title,
    video: preset.video,
    poster: preset.poster,
    scenes: preset.scenes.map(([title, description, format]) => ({ title, description, format })),
  };
}

function initializeExperience(root = document) {
  const form = root.querySelector("[data-prompt-form]");
  const input = root.querySelector("[data-topic-input]");
  if (!form || !input) return;

  const views = Object.fromEntries(
    [...root.querySelectorAll("[data-view]")].map((view) => [view.dataset.view, view]),
  );
  const stepItems = [...root.querySelectorAll("[data-step-item]")];
  const characterCount = root.querySelector("[data-character-count]");
  const progressTopic = root.querySelector("[data-progress-topic]");
  const progressTitle = root.querySelector("[data-progress-title]");
  const progressTrack = root.querySelector("[data-progress-track]");
  const progressBar = root.querySelector("[data-progress-bar]");
  const liveStatus = root.querySelector("[data-live-status]");
  const sceneList = root.querySelector("[data-scene-list]");
  const resultTitle = root.querySelector("[data-result-title]");
  const previewVideo = root.querySelector("[data-preview-video]");
  const restartButton = root.querySelector("[data-restart-button]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let runToken = 0;

  const showView = (name) => {
    Object.entries(views).forEach(([viewName, element]) => {
      element.hidden = viewName !== name;
    });
    const activeStep = name === "input" ? 1 : name === "progress" ? 2 : 3;
    stepItems.forEach((item, index) => {
      item.classList.toggle("is-active", index + 1 === activeStep);
      item.classList.toggle("is-complete", index + 1 < activeStep);
    });
  };

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const updateCount = () => {
    characterCount.textContent = String(input.value.length);
  };

  const renderPlan = (plan) => {
    resultTitle.textContent = plan.title;
    sceneList.replaceChildren();
    plan.scenes.forEach((scene, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      const description = document.createElement("p");
      const format = document.createElement("small");
      number.textContent = String(index + 1).padStart(2, "0");
      title.textContent = scene.title;
      description.textContent = scene.description;
      format.textContent = scene.format;
      copy.append(title, description, format);
      item.append(number, copy);
      sceneList.append(item);
    });

    previewVideo.pause();
    previewVideo.poster = plan.poster;
    previewVideo.src = plan.video;
    previewVideo.load();
    previewVideo.play().catch(() => {
      // The poster remains as an accessible visual fallback when autoplay is blocked.
    });
  };

  const runDemo = async (topic) => {
    const token = ++runToken;
    const plan = buildDemoPlan(topic);
    progressTopic.textContent = plan.topic;
    progressTrack.setAttribute("aria-valuenow", "0");
    progressBar.style.width = "0%";
    root.querySelectorAll("[data-phase]").forEach((phase) => phase.classList.remove("is-active", "is-complete"));
    showView("progress");

    const phaseDelay = reducedMotion.matches ? 90 : 780;
    for (let index = 0; index < PHASES.length; index += 1) {
      if (token !== runToken) return;
      const [id, label, progress] = PHASES[index];
      const phase = root.querySelector(`[data-phase="${id}"]`);
      root.querySelectorAll("[data-phase]").forEach((item) => item.classList.remove("is-active"));
      phase.classList.add("is-active");
      progressTitle.textContent = label;
      liveStatus.textContent = label;
      progressTrack.setAttribute("aria-valuenow", String(progress));
      progressBar.style.width = `${progress}%`;
      await wait(phaseDelay);
      phase.classList.remove("is-active");
      phase.classList.add("is-complete");
    }

    if (token !== runToken) return;
    renderPlan(plan);
    showView("result");
    views.result.querySelector("h3")?.focus({ preventScroll: true });
  };

  input.addEventListener("input", updateCount);
  root.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.example;
      updateCount();
      input.focus();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const topic = normalizeTopic(input.value);
    if (!topic) {
      input.focus();
      return;
    }
    input.value = topic;
    updateCount();
    runDemo(topic);
  });

  restartButton?.addEventListener("click", () => {
    runToken += 1;
    previewVideo.pause();
    showView("input");
    input.focus();
  });

  updateCount();
  showView("input");
}

if (typeof document !== "undefined") {
  initializeExperience();
}
