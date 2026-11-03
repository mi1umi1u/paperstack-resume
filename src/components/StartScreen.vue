<script setup lang="ts">
withDefaults(defineProps<{ canCopy?: boolean }>(), { canCopy: false })
const emit = defineEmits<{
  (e: 'import'): void
  (e: 'blank'): void
  (e: 'copy'): void
  (e: 'restore'): void
}>()
</script>

<template>
  <main class="start-screen">
    <div class="start-orbit start-orbit-a" aria-hidden="true" />
    <div class="start-orbit start-orbit-b" aria-hidden="true" />

    <header class="start-brandline">
      <div class="start-brand">
        <span class="start-logo">纸栈</span>
        <span class="start-brand-en">PAPERSTACK</span>
      </div>
      <span class="start-local"><i /> LOCAL ONLY · 本机运行</span>
    </header>

    <div class="start-layout">
      <section class="start-copy-panel">
        <p class="start-kicker"><span>一页纸工作室</span> 不需要登录的简历工作台</p>
        <h1>把散落的经历，<br><em>理成一页好纸。</em></h1>
        <p class="start-lede">
          旧简历可以重新读懂，空白也可以慢慢写。
          不催你填满，只帮你把真正做过的事放回合适的位置。
        </p>

        <div class="start-choices">
          <button class="start-choice start-choice-import" type="button" aria-label="导入旧简历" @click="emit('import')">
            <span class="choice-index">01</span>
            <span class="choice-arrow" aria-hidden="true">↗</span>
            <span class="start-choice-title">带一份旧简历来</span>
            <span class="start-choice-desc">Word、PDF 或一段旧文本。识别之后，逐项确认再落纸。</span>
            <span class="choice-foot">导入与识别</span>
          </button>

          <button class="start-choice start-choice-blank" type="button" aria-label="从零创建" @click="emit('blank')">
            <span class="choice-index">02</span>
            <span class="choice-arrow" aria-hidden="true">↗</span>
            <span class="start-choice-title">从一张白纸开始</span>
            <span class="start-choice-desc">先不套格式。把做过的事写清楚，再考虑它应该长什么样。</span>
            <span class="choice-foot">新建简历</span>
          </button>
        </div>

        <div class="start-links">
          <button v-if="canCopy" class="start-copy" type="button" @click="emit('copy')">复制当前版本</button>
          <button class="start-copy" type="button" @click="emit('restore')">恢复完整备份</button>
        </div>

        <p class="start-privacy">
          <span class="privacy-seal">私</span>
          数据只保存在本机浏览器，不注册、不上传，断网也能用。AI 只有你主动开启并确认发送时才联网。
        </p>
      </section>

      <aside class="start-art" aria-hidden="true">
        <div class="art-word">纸短<br>事长</div>
        <div class="paper-stack">
          <div class="paper-back paper-back-one" />
          <div class="paper-back paper-back-two" />
          <div class="paper-face">
            <div class="paper-meta"><span>PAPERSTACK / 001</span><span>一页</span></div>
            <div class="paper-name">你的名字</div>
            <div class="paper-role">把经历写成一页好纸</div>
            <div class="paper-rule" />
            <div class="paper-section"><b>经历</b><span>做过什么 · 解决了什么</span></div>
            <div class="paper-line w90" />
            <div class="paper-line w76" />
            <div class="paper-line w84" />
            <div class="paper-section"><b>能力</b><span>不是形容词，是证据</span></div>
            <div class="paper-line w66" />
            <div class="paper-line w82" />
            <div class="paper-stamp">本机<br>成稿</div>
          </div>
        </div>
        <p class="art-caption">你的经历 · 你的纸张 · 你的电脑</p>
      </aside>
    </div>

    <footer class="start-footer">
      <span>PAPERSTACK / LOCAL RESUME ATELIER</span>
      <span>好简历不是写满，是让重要的事有处落脚。</span>
    </footer>
  </main>
</template>

<style scoped>
.start-screen{
  --start-ink:#1e1c18;--start-muted:#777064;--start-paper:#fffdf7;--start-red:#9f3f30;--start-green:#416b58;
  position:relative;min-height:100vh;overflow:hidden;padding:34px clamp(24px,6vw,92px) 26px;
  display:flex;flex-direction:column;color:var(--start-ink);
  background:
    radial-gradient(circle at 84% 18%,rgba(255,255,255,.9),transparent 23%),
    radial-gradient(circle at 20% 90%,rgba(217,204,182,.46),transparent 34%),
    linear-gradient(128deg,#f2eee4 0%,#e9e3d6 56%,#e3dccd 100%);
}
.start-screen::after{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.28;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.09'/%3E%3C/svg%3E");
  mix-blend-mode:multiply;
}
.start-orbit{position:absolute;border:1px solid rgba(116,101,80,.13);border-radius:50%;pointer-events:none}
.start-orbit-a{width:620px;height:620px;right:-180px;top:-280px}
.start-orbit-b{width:460px;height:460px;right:170px;top:340px;border-color:rgba(159,63,48,.1)}
.start-brandline{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:20px}
.start-brand{display:flex;align-items:baseline;gap:12px}
.start-logo{font-family:var(--kai);font-size:29px;font-weight:700;letter-spacing:.1em;color:var(--start-red)}
.start-brand-en{font:10px Georgia,serif;letter-spacing:.24em;color:#797162}
.start-local{display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:rgba(255,253,247,.55);
  border:1px solid rgba(66,94,76,.18);font:9px Georgia,serif;letter-spacing:.12em;color:#526759}
.start-local i{width:6px;height:6px;border-radius:50%;background:#5f866e;box-shadow:0 0 0 3px rgba(95,134,110,.12)}
.start-layout{position:relative;z-index:2;flex:1;display:grid;grid-template-columns:minmax(0,1.14fr) minmax(280px,.76fr);
  align-items:center;gap:clamp(34px,6vw,90px);max-width:1280px;width:100%;margin:0 auto;padding:38px 0 28px}
.start-copy-panel{max-width:740px;animation:rise .65s ease-out both}
.start-kicker{margin:0 0 19px;color:#7b7264;font-size:10px;letter-spacing:.12em;display:flex;align-items:center;gap:10px}
.start-kicker span{color:var(--start-red);font-size:11px;letter-spacing:.18em;border-bottom:1px solid rgba(159,63,48,.45);padding-bottom:2px}
.start-copy-panel h1{margin:0;font-family:"Songti SC",STSong,SimSun,serif;font-size:clamp(38px,5vw,69px);
  line-height:1.16;font-weight:600;letter-spacing:-.035em}
.start-copy-panel h1 em{font-style:normal;color:var(--start-red);position:relative}
.start-copy-panel h1 em::after{content:"";position:absolute;left:2%;right:1%;bottom:-8px;height:8px;
  background:linear-gradient(90deg,rgba(159,63,48,.28),rgba(159,63,48,0));transform:skewX(-14deg)}
.start-lede{max-width:620px;margin:23px 0 0;color:#70695d;font-size:13px;line-height:2}
.start-choices{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:35px}
.start-choice{
  position:relative;min-height:186px;padding:20px 21px 17px;border:1px solid rgba(83,71,55,.16);
  border-radius:28px 8px 28px 8px;text-align:left;color:var(--start-ink);cursor:pointer;overflow:hidden;
  background:rgba(255,253,247,.82);box-shadow:0 14px 36px -30px rgba(52,38,24,.55);
  transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease;
  display:flex;flex-direction:column;align-items:flex-start
}
.start-choice-blank{border-radius:8px 28px 8px 28px;background:rgba(246,241,231,.72)}
.start-choice::after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;right:-55px;bottom:-65px;
  border:1px solid rgba(159,63,48,.12);transition:transform .25s ease}
.start-choice:hover{transform:translateY(-5px) rotate(-.25deg);border-color:rgba(159,63,48,.46);
  background:var(--start-paper);box-shadow:0 22px 42px -28px rgba(65,42,28,.42)}
.start-choice:hover::after{transform:scale(1.22)}
.choice-index{font:10px Georgia,serif;letter-spacing:.14em;color:#9c9384}
.choice-arrow{position:absolute;right:20px;top:18px;font:20px Georgia,serif;color:var(--start-red);transition:transform .22s ease}
.start-choice:hover .choice-arrow{transform:translate(3px,-3px)}
.start-choice-title{margin-top:22px;font-family:"Songti SC",STSong,SimSun,serif;font-size:21px;font-weight:600;letter-spacing:.02em}
.start-choice-desc{margin-top:8px;color:#787063;font-size:11px;line-height:1.75;max-width:260px}
.choice-foot{margin-top:auto;padding-top:14px;font-size:9px;letter-spacing:.1em;color:var(--start-red)}
.start-links{display:flex;gap:8px;margin-top:14px}
.start-copy{border:0;background:transparent;padding:5px 0;color:#756d61;font-size:10.5px;cursor:pointer}
.start-copy+.start-copy::before{content:"/";margin-right:8px;color:#b7ad9e}
.start-copy:hover{color:var(--start-red)}
.start-privacy{display:flex;align-items:flex-start;gap:9px;margin:20px 0 0;max-width:650px;
  color:#81796c;font-size:10px;line-height:1.75}
.privacy-seal{flex:none;width:19px;height:19px;border:1px solid rgba(159,63,48,.55);color:var(--start-red);
  display:inline-grid;place-items:center;border-radius:4px;font-family:var(--kai);font-size:10px;margin-top:-1px}
.start-art{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:490px;animation:rise .75s .12s ease-out both}
.art-word{position:absolute;right:-14px;top:10px;writing-mode:vertical-rl;font-family:var(--kai);font-size:42px;
  letter-spacing:.18em;line-height:1.3;color:rgba(70,63,52,.09);user-select:none}
.paper-stack{position:relative;width:min(330px,86%);aspect-ratio:.707;transform:rotate(1.4deg)}
.paper-back{position:absolute;inset:0;border-radius:2px 14px 3px 10px;background:#e2d7c3;border:1px solid rgba(95,79,58,.12)}
.paper-back-one{transform:translate(-13px,15px) rotate(-3.2deg)}
.paper-back-two{transform:translate(11px,8px) rotate(2.1deg);background:#eee7d9}
.paper-face{position:relative;height:100%;padding:28px 27px;background:#fffdf7;border:1px solid rgba(90,76,58,.2);
  border-radius:2px 10px 3px 8px;box-shadow:0 28px 55px -30px rgba(60,44,30,.48);overflow:hidden}
.paper-face::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(#9f3f30,#7e3328)}
.paper-meta{display:flex;justify-content:space-between;color:#928878;font:8px Georgia,serif;letter-spacing:.12em}
.paper-name{margin-top:42px;font-family:"Songti SC",STSong,SimSun,serif;font-size:29px;letter-spacing:.12em;color:#29251f}
.paper-role{margin-top:6px;color:#938a7c;font-size:9px;letter-spacing:.08em}
.paper-rule{height:1px;background:#cfc5b4;margin:18px 0 16px}
.paper-section{display:flex;align-items:baseline;gap:8px;margin:17px 0 9px;color:#4f493f;font-size:8px}
.paper-section b{font-family:var(--kai);font-size:12px;color:#9f3f30;letter-spacing:.1em}
.paper-section span{color:#aaa08f}
.paper-line{height:4px;margin:8px 0;border-radius:999px;background:#e6dfd2}
.paper-line.w90{width:90%}.paper-line.w84{width:84%}.paper-line.w82{width:82%}.paper-line.w76{width:76%}.paper-line.w66{width:66%}
.paper-stamp{position:absolute;right:24px;bottom:27px;width:48px;height:48px;border:1px solid rgba(159,63,48,.7);
  border-radius:50%;display:grid;place-items:center;text-align:center;color:var(--start-red);font-family:var(--kai);
  font-size:8px;line-height:1.35;transform:rotate(-9deg)}
.art-caption{margin:22px 0 0;font:8px Georgia,serif;letter-spacing:.2em;color:#928777}
.start-footer{position:relative;z-index:2;display:flex;justify-content:space-between;gap:20px;border-top:1px solid rgba(91,76,57,.14);
  padding-top:14px;color:#918778;font:8.5px Georgia,serif;letter-spacing:.12em}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){
  .start-screen{padding:25px 22px;overflow:auto}
  .start-layout{grid-template-columns:1fr;padding:36px 0 20px;align-items:start}
  .start-art{display:none}
  .start-copy-panel h1{font-size:clamp(36px,9vw,56px)}
  .start-footer{flex-direction:column;gap:5px}
}
@media(max-width:620px){
  .start-local{display:none}
  .start-kicker{display:block;line-height:1.8}
  .start-choices{grid-template-columns:1fr;margin-top:28px}
  .start-choice{min-height:162px}
  .start-brand-en{display:none}
}
@media(prefers-reduced-motion:reduce){
  .start-copy-panel,.start-art{animation:none}
  .start-choice{transition:none}
}
</style>
