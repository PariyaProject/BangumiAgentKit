# Run #95 UX-001 OAuth、auth_status 与收藏图片逐图验收

复核日期：2026-10-18。BGK 候选分支：`codex/epoch-run95-ux001-oauth-personal-collection-visual-20261018`，基线 `e26b5c07aa94fb667160002f4bba364f98123894`。

## 范围与结果

全部 65 张 PNG 都由合成数据生成并逐张打开检查：4 种 OAuth 回调状态、9 种收藏渲染案例，各在 320/360/520/640/960 CSS px、DPR 1 下渲染。自动检查结果为无横向溢出、无缺少预期文案、无未加载的预期图片。后续修正重新生成部分空状态后，原有 60 张的 SHA-256 全部与本报告记录相同；对应的 5 张显示首个请求成功并返回空页，但 Bangumi 源报告 3 条，因此明确标记为部分覆盖，不能确认收藏为空。原图保留在本机忽略目录，报告逐图记录 PNG 尺寸和 SHA-256；PNG 本身未加入 Git。

只用了本地 fixture：真实 OAuth/账号请求 0 次，QQ/TIM 操作 0 次。完成的仍是合成表达和图像验收，不计入真实账号、QQ/TIM 或 96 工具客户端覆盖。自动化清单：`.artifacts/render/ux001-auth-personal-visual-qa-2026-10-18/manifest.json`。生成器仅记录自动布局/文字/消息配对断言，不声称完成了人工视觉检查；逐张人工观察记录在本报告下表。

## 四种 auth_status 消息

该工具交付纯文本，因此按状态核对句子，不生成假截图。绑定状态、可执行的下一步和凭证证据边界都有说明；凭证可刷新不被表述为个人数据请求已成功。

| 合成状态 | 实际消息 | 观察 |
| --- | --- | --- |
| `unbound` | 尚未绑定 Bangumi 账号。需要个人收藏功能时，再发起授权；公开查询无需绑定。 | 公共查询仍可用，个人功能需要时再授权。 |
| `bindingNeedsAttention` | 检测到 2 条 Bangumi 账号绑定记录，但当前无法确认可用的活动账号资料。请检查绑定状态，必要时重新授权；个人收藏查询暂不可用。 | 当前状态不能区分“没有活动绑定”和“活动绑定的账号资料缺失”，因此不给出错误的切换账号结论。 |
| `boundWithoutCredential` | 已绑定 合成账号 (@synthetic-user)，但本地缺少授权凭证记录。请重新授权后再使用个人收藏功能。 | 显示本地凭证记录缺失并建议重新授权，不声称已登录成功。 |
| `boundWithCredential` | 已绑定 合成账号 (@synthetic-user)。本地凭证记录显示到期时间 2026-10-20T10:00:00.000Z，刷新状态：可刷新。这只反映本地记录，不代表个人数据请求已成功；需要个人收藏时可继续查询，若请求提示授权失效再重新授权。 | 仅报告本地到期/刷新记录，并明确其不证明上游个人数据请求成功。 |

## 收藏图片与配图消息配对

45 张收藏渲染图（9 个案例 × 5 个宽度）都绑定到同一合成 `boundWithCredential` 状态，并为每张图片使用渲染工具实际返回的 companion message 生成器。Progress caption 从同一个 progress ViewModel 读取条目名、收藏状态、集数和评分，不复制评论；intelligence caption 从同一个 ViewModel 读取状态、sourceTotal、已读/去重行数、页进度和已看集数。生成器断言每条 caption 都含有对应 ViewModel 的事实及下一步，并把 auth_status id/message、caption、状态、覆盖、进度和断言结果写入逐图 manifest；PNG 的自动文字检查也逐项核对对应事实。缺少数据的空/不可用图片不会被 caption 补成“已看 0 集”。

生成器还逐页统计链接、按钮、输入框和显式 tab-stop；当前 65 张均为 0 个交互控件，因此键盘焦点环对这些只读页面不适用。未来若页面加入交互控件，生成器会在它们没有显式焦点可见性检查时失败。层级与小屏可读性仍由下方逐图视觉观察记录覆盖。

这项配对证据覆盖本地合成工具输出及 Renderer，不等于验证了 Agent 在真实对话中把 auth_status 文本和 Artifact 按预期组合，也不等于 QQ/TIM 客户端布局验收。

## 历史版本对照

分别固定在已审计的两个历史 commit，对照授权确认与登录后个人收藏结果。下面列的是逐张打开的相关公开指南截图，不代表扫描了旧仓库中的所有媒体文件。

| 历史快照 | 逐张打开的截图 | 观察与当前改进目标 |
| --- | --- | --- |
| Bangumi-for-QQ `b44d493dd6f5044d6fe305292016908ae15ef933` | `media/e4d9dbc9ce6b3dae5a3ebbd7926dc048.png`, `914d2774ff1de44f97d0eb8ec6a9f5aa.png`, `905dcfa06ed6ac81ee0fea9fe331fa57.png`, `ac505777c71ea039838a9424174868ad.png`, `7aab1c496126a773b725101edd346e73.png`, `b3e23f97987d9663a4549db38f9087da.png`, `c8929327ccb1a52bf22e2cb59544fd8a.png`, `9e8d7c71fc35112c255a793b4766e08c.png`, `2bca3a8ce69f44e94afdc469c0c39a8b.png`, `0cc9b4ff41397e2a5106e162ae69d2cd.png`, `370e371141fe7862e4664b1e01d83ce8.png`, `a3a74ba9445dd0b04c57714d075a5b5f.png`, `147a49a1a707e43215848789ddd280d9.png`, `c906ff4eb94e9c483de1787430a7c637.png`, `7da6c19c2a29845c00b70dbe5e3e3f93.png`, `c43dd4181d4da5f67c675218e4d620b9.png`, `80d9b4c4cece1be2676c3687d2ae2cfe.png`, `9ac1f43b4079c8c218cb7b57788cddc1.png` | 私聊有即时完成消息；授权时解释读取/写入范围；搜索/条目回复突出封面并把个人状态、进度放在详情末尾。登录后事实覆盖丰富，但长回复、窄列和密集行难扫读；回调成功图是装饰画，完成含义主要靠 QQ 回复。 |
| Bangumi-QQ-Bot-CPP `f1c75bc366755d8bd7bf35ee5c11b513cb066f8e` | `page/pic/reg.png`, `reg_web_bgm.png`, `reg_web_over.png`, `reg_qq_over.png`, `search.png`, `subject_base.png`, `subject_plus1.png`, `collection_default.png`, `update_default.png`, `subject_extra.png` | consent 页清晰列权限；私聊卡片和确认消息即时；封面与状态/进度并存，subject_plus1 直接展示用户收藏与完成度。成功回调仍为装饰图，长结果以窄消息连续输出。当前合成卡保留封面、账号事实与进度，并增加部分/空/失败状态和手机断行验收。 |

对照入口：[Bangumi-for-QQ 指南（固定 commit）](https://github.com/Kurarion/Bangumi-for-QQ/blob/b44d493dd6f5044d6fe305292016908ae15ef933/Bangumi%E5%A8%98%E7%9A%84%E9%A3%9F%E7%94%A8%E6%8C%87%E5%8D%97.md)，[Bangumi-QQ-Bot-CPP 指南（固定 commit）](https://github.com/Kurarion/Bangumi-QQ-Bot-CPP/blob/f1c75bc366755d8bd7bf35ee5c11b513cb066f8e/bangumi.md)。

## 每张最终 PNG 的人工检查记录

| 案例 | 视口 | 文件（PNG） | SHA-256 | 自动检查 | 逐图观察 |
| --- | ---: | --- | --- | --- | --- |
| `callback-success-long-identity` | 320 CSS px | `callback-success-long-identity-w320.png` (320×900) | `b93bf3c8c7eb5fb41ef15a96021414769fbcf2b48e0a1ef7b8a54828020d37ce` | 无溢出；预期文案齐全；图片元素 0 | 320px：成功状态和“绑定成功”标题完整可见；长中英账号名自然换行，下一步指引仍在卡片内。 |
| `callback-success-long-identity` | 360 CSS px | `callback-success-long-identity-w360.png` (360×900) | `09e4ccf42d0ce596aa44c87016df247267e31f7bfb2a424f551d22832a006623` | 无溢出；预期文案齐全；图片元素 0 | 360px：成功状态和“绑定成功”标题完整可见；长中英账号名自然换行，下一步指引仍在卡片内。 |
| `callback-success-long-identity` | 520 CSS px | `callback-success-long-identity-w520.png` (520×900) | `c2cb39fc8b89c63b1aaffb10211f119a1c1ae278351091eb47d2744f85f35164` | 无溢出；预期文案齐全；图片元素 0 | 520px：成功状态、长账号名和返回聊天窗口的下一步指引均清楚；没有显示 code/state 或凭证。 |
| `callback-success-long-identity` | 640 CSS px | `callback-success-long-identity-w640.png` (640×900) | `5d744e1f578905c87e644acca3fa32cc8bb45437798d35b5906571ec8ebb02f5` | 无溢出；预期文案齐全；图片元素 0 | 640px：成功状态、长账号名和返回聊天窗口的下一步指引均清楚；没有显示 code/state 或凭证。 |
| `callback-success-long-identity` | 960 CSS px | `callback-success-long-identity-w960.png` (960×900) | `ab287e98c7748055dbc7319a9305eb6b8a0380b1936b17d7da01db86816e9c55` | 无溢出；预期文案齐全；图片元素 0 | 960px：成功状态、长账号名和返回聊天窗口的下一步指引均清楚；没有显示 code/state 或凭证。 |
| `callback-provider-denial` | 320 CSS px | `callback-provider-denial-w320.png` (320×900) | `a69895b6835962f13b4f262abe41b483303b6c3f80ddc814729229e7bcfd2aaf` | 无溢出；预期文案齐全；图片元素 0 | 320px：琥珀色取消状态与“已有绑定状态没有改变”清楚区分系统错误；重新授权建议完整可见。 |
| `callback-provider-denial` | 360 CSS px | `callback-provider-denial-w360.png` (360×900) | `ce381aa3f2f9c92389ddcf0a791931bed4996c33a734ba593c625d440f76be0f` | 无溢出；预期文案齐全；图片元素 0 | 360px：琥珀色取消状态与“已有绑定状态没有改变”清楚区分系统错误；重新授权建议完整可见。 |
| `callback-provider-denial` | 520 CSS px | `callback-provider-denial-w520.png` (520×900) | `15919d33682228d6b14f5973e652fc9d28769676eb7409f4dd03761dc6bd3e82` | 无溢出；预期文案齐全；图片元素 0 | 520px：琥珀色取消状态与“已有绑定状态没有改变”清楚区分系统错误；重新授权建议完整可见。 |
| `callback-provider-denial` | 640 CSS px | `callback-provider-denial-w640.png` (640×900) | `14453c409866603908f44fe212d26dd03cb33a5f805934749729e8dd32e2aa6d` | 无溢出；预期文案齐全；图片元素 0 | 640px：琥珀色取消状态与“已有绑定状态没有改变”清楚区分系统错误；重新授权建议完整可见。 |
| `callback-provider-denial` | 960 CSS px | `callback-provider-denial-w960.png` (960×900) | `cefe5ce0a6dfbbae691f559d7166c6eff376fc4f1870500210a725c69154ec13` | 无溢出；预期文案齐全；图片元素 0 | 960px：琥珀色取消状态与“已有绑定状态没有改变”清楚区分系统错误；重新授权建议完整可见。 |
| `callback-invalid-state` | 320 CSS px | `callback-invalid-state-w320.png` (320×900) | `e1ec9722e606fafbd316f4a6807b30860eba297732748f704e1332ced04cff60` | 无溢出；预期文案齐全；图片元素 0 | 320px：红色失败状态提供中性原因和重新发起指引；没有显示无效 state 或授权码。 |
| `callback-invalid-state` | 360 CSS px | `callback-invalid-state-w360.png` (360×900) | `aef7ff22f67ca4f9a09a351d99cde5efb19785c25188f43e486178dfacad35f8` | 无溢出；预期文案齐全；图片元素 0 | 360px：红色失败状态提供中性原因和重新发起指引；没有显示无效 state 或授权码。 |
| `callback-invalid-state` | 520 CSS px | `callback-invalid-state-w520.png` (520×900) | `7b15fe9807c156c674813ef46fbe0d453a3bee06b07d9e41b4d64789267b1d4e` | 无溢出；预期文案齐全；图片元素 0 | 520px：红色失败状态提供中性原因和重新发起指引；没有显示无效 state 或授权码。 |
| `callback-invalid-state` | 640 CSS px | `callback-invalid-state-w640.png` (640×900) | `9d5ccc9904dafa3746d4cbdda64404381c2c5a38a5b04fb85734a91b7107e970` | 无溢出；预期文案齐全；图片元素 0 | 640px：红色失败状态提供中性原因和重新发起指引；没有显示无效 state 或授权码。 |
| `callback-invalid-state` | 960 CSS px | `callback-invalid-state-w960.png` (960×900) | `b96ce80842aaf369dc3c8c85f0116aa39d49f677506b4052e213ea2428cd0108` | 无溢出；预期文案齐全；图片元素 0 | 960px：红色失败状态提供中性原因和重新发起指引；没有显示无效 state 或授权码。 |
| `callback-internal-failure` | 320 CSS px | `callback-internal-failure-w320.png` (320×900) | `3fae47813ab2fe1bfd180b538be792588df670bc2c395e710373337ea033d4cd` | 无溢出；预期文案齐全；图片元素 0 | 320px：失败页只显示通用内部错误和下一步；没有原始异常、上游响应或凭证。 |
| `callback-internal-failure` | 360 CSS px | `callback-internal-failure-w360.png` (360×900) | `608f44337ad746b781fa97d426c58b50f229587e2d0611520f8c6f4866e3e1e3` | 无溢出；预期文案齐全；图片元素 0 | 360px：失败页只显示通用内部错误和下一步；没有原始异常、上游响应或凭证。 |
| `callback-internal-failure` | 520 CSS px | `callback-internal-failure-w520.png` (520×900) | `a795b713a78f21ed17325f02e7f32371b4c9787e49fe0e8c0eb2b0eeb1024819` | 无溢出；预期文案齐全；图片元素 0 | 520px：失败页只显示通用内部错误和下一步；没有原始异常、上游响应或凭证。 |
| `callback-internal-failure` | 640 CSS px | `callback-internal-failure-w640.png` (640×900) | `b4fde42e987af758410ac0613b2734630a1ff48429fa7de7e7b1747a87b3148d` | 无溢出；预期文案齐全；图片元素 0 | 640px：失败页只显示通用内部错误和下一步；没有原始异常、上游响应或凭证。 |
| `callback-internal-failure` | 960 CSS px | `callback-internal-failure-w960.png` (960×900) | `fb473247a508f92334479abf716bc1e25533ab99bc3b095f4ff5f25b4796349b` | 无溢出；预期文案齐全；图片元素 0 | 960px：失败页只显示通用内部错误和下一步；没有原始异常、上游响应或凭证。 |
| `collection-progress-complete` | 320 CSS px | `collection-progress-complete-w320.png` (320×900) | `251c4642d07906be465e2c92122063de0aa9695b8e077d14c92f290389706fb0` | 无溢出；预期文案齐全；图片元素 1 | 320px：合成海报居中堆叠，标题、收藏状态、已看集数、评分和进度条均可见；简评换行完整。 |
| `collection-progress-complete` | 360 CSS px | `collection-progress-complete-w360.png` (360×900) | `a8356ca3f005bcc16b60327539fd8bba772acec94388d6510192e6589fec3204` | 无溢出；预期文案齐全；图片元素 1 | 360px：合成海报居中堆叠，标题、收藏状态、已看集数、评分和进度条均可见；简评换行完整。 |
| `collection-progress-complete` | 520 CSS px | `collection-progress-complete-w520.png` (520×900) | `2c1dc849a7ce8eae8165a25f55ad5720dfa04e292d162b7d7bc44053c3b9fe68` | 无溢出；预期文案齐全；图片元素 1 | 520px：合成海报、条目标题、状态、集数、评分和进度层级清楚；海报与标题并排，状态条和简评不溢出。 |
| `collection-progress-complete` | 640 CSS px | `collection-progress-complete-w640.png` (640×900) | `afdf2add6c4377076ab741e12fb5e1e0c69d39aec19906eb1297b731f08a6cd9` | 无溢出；预期文案齐全；图片元素 1 | 640px：合成海报、条目标题、状态、集数、评分和进度层级清楚；海报与标题并排，状态条和简评不溢出。 |
| `collection-progress-complete` | 960 CSS px | `collection-progress-complete-w960.png` (960×900) | `0949b2e9d63a09b4e03e8815f8bd7b3d0ef07fb68fcf995367443651b0e2e08e` | 无溢出；预期文案齐全；图片元素 1 | 960px：合成海报、条目标题、状态、集数、评分和进度层级清楚；宽屏横向排版留白均匀。 |
| `collection-progress-long-mixed-script` | 320 CSS px | `collection-progress-long-mixed-script-w320.png` (320×900) | `7b3001e0a850da3f0f25ef9d54987321480038afa630927057468f6cde5db33e` | 无溢出；预期文案齐全；图片元素 1 | 320px：海报与长中英标题堆叠；混合文字、状态、集数、评分和简评均自然换行，未挤出卡片。 |
| `collection-progress-long-mixed-script` | 360 CSS px | `collection-progress-long-mixed-script-w360.png` (360×900) | `7075aebdccfc705ec19309234c3ca5f376c98c92ce85e80b9f08195f6d5f29c6` | 无溢出；预期文案齐全；图片元素 1 | 360px：海报与长中英标题堆叠；混合文字、状态、集数、评分和简评均自然换行，未挤出卡片。 |
| `collection-progress-long-mixed-script` | 520 CSS px | `collection-progress-long-mixed-script-w520.png` (520×900) | `0a960bd1a6bf17a4bfe3bdecf2c181d8058570c539d93e0b20083aab9850d812` | 无溢出；预期文案齐全；图片元素 1 | 520px：长中文标题与英文副标题可辨；海报与标题分栏，状态、进度和中英简评完整。 |
| `collection-progress-long-mixed-script` | 640 CSS px | `collection-progress-long-mixed-script-w640.png` (640×900) | `b0eacd45cf2155b56cb3cebda5275a0aa8de66c3665e0a7dac90f46b769904fe` | 无溢出；预期文案齐全；图片元素 1 | 640px：长中文标题与英文副标题可辨；海报与标题分栏，状态、进度和中英简评完整。 |
| `collection-progress-long-mixed-script` | 960 CSS px | `collection-progress-long-mixed-script-w960.png` (960×900) | `16c1acded7b3d3c726251bf9d6157e80e5021dae8646c1389739abf3651e6d76` | 无溢出；预期文案齐全；图片元素 1 | 960px：长中文标题与英文副标题可辨；海报与标题分栏，状态、进度和中英简评完整。 |
| `collection-progress-missing-cover-fields` | 320 CSS px | `collection-progress-missing-cover-fields-w320.png` (320×900) | `3c8043bd527dbfd6ee0dcb454c42e761b4248a135720d878f940ea597d9b2357` | 无溢出；预期文案齐全；图片元素 0 | 320px：使用“暂无封面”占位；没有编造总集数和评分，想看状态及 0 集清楚。 |
| `collection-progress-missing-cover-fields` | 360 CSS px | `collection-progress-missing-cover-fields-w360.png` (360×900) | `8f2f0be0ba083b26fcfae1766f6aff4296b525711f4c6f8b0c8fbc058097c979` | 无溢出；预期文案齐全；图片元素 0 | 360px：使用“暂无封面”占位；没有编造总集数和评分，想看状态及 0 集清楚。 |
| `collection-progress-missing-cover-fields` | 520 CSS px | `collection-progress-missing-cover-fields-w520.png` (520×900) | `8fde0dd02b4b6f0615af8fac348b2c853131d1b4b556ae945121a3d34b130b3b` | 无溢出；预期文案齐全；图片元素 0 | 520px：“暂无封面”占位、条目标题与想看状态清楚；缺失的总集数和评分保持为空。 |
| `collection-progress-missing-cover-fields` | 640 CSS px | `collection-progress-missing-cover-fields-w640.png` (640×900) | `f9c1e2458979eba7eb8ed38b6f832f0d41ae825d2a75436e070b70568d2d2613` | 无溢出；预期文案齐全；图片元素 0 | 640px：“暂无封面”占位、条目标题与想看状态清楚；缺失的总集数和评分保持为空。 |
| `collection-progress-missing-cover-fields` | 960 CSS px | `collection-progress-missing-cover-fields-w960.png` (960×900) | `bf1988c329779d7784f82fc8d04e888fd3c3e3c3dca83e6bf27cba3a7c67311a` | 无溢出；预期文案齐全；图片元素 0 | 960px：“暂无封面”占位、条目标题与想看状态清楚；缺失的总集数和评分保持为空。 |
| `collection-progress-cover-fetch-failure` | 320 CSS px | `collection-progress-cover-fetch-failure-w320.png` (320×900) | `3cef41139d7400fb07483bb89b3158ebd693f48a87106f8f4d8b5f61d1a051c0` | 无溢出；预期文案齐全；图片元素 0 | 320px：使用“封面暂不可用”占位并保留已完成、集数、评分和 100% 进度。 |
| `collection-progress-cover-fetch-failure` | 360 CSS px | `collection-progress-cover-fetch-failure-w360.png` (360×900) | `1534b3cf5b1bb958b1388c0041c6cf13bd8d5f9847aee43121799afd26e77246` | 无溢出；预期文案齐全；图片元素 0 | 360px：使用“封面暂不可用”占位并保留已完成、集数、评分和 100% 进度。 |
| `collection-progress-cover-fetch-failure` | 520 CSS px | `collection-progress-cover-fetch-failure-w520.png` (520×900) | `3bd2ccb66898598e6255f22a4ba4a84606ef22bf0d761dbaed018ae372a9aa1e` | 无溢出；预期文案齐全；图片元素 0 | 520px：失败封面占位与条目信息分开；已完成状态、集数、评分和进度条仍一致。 |
| `collection-progress-cover-fetch-failure` | 640 CSS px | `collection-progress-cover-fetch-failure-w640.png` (640×900) | `a69a6cc6e87a2f3548a9a431841458ed48e863f8acde9a5891940339b6538ff9` | 无溢出；预期文案齐全；图片元素 0 | 640px：失败封面占位与条目信息分开；已完成状态、集数、评分和进度条仍一致。 |
| `collection-progress-cover-fetch-failure` | 960 CSS px | `collection-progress-cover-fetch-failure-w960.png` (960×900) | `c4805921e664628962b950585de4fbfdddcdf998bdf90b02213a6be13eb0da8d` | 无溢出；预期文案齐全；图片元素 0 | 960px：失败封面占位与条目信息分开；已完成状态、集数、评分和进度条仍一致。 |
| `collection-intelligence-complete` | 320 CSS px | `collection-intelligence-complete-w320.png` (320×1363) | `12d47e3816cc27067f87dc89cc4ad75eba707c55d015a1c43cc961ce2205e3d2` | 无溢出；预期文案齐全；图片元素 0 | 320px：完整覆盖状态、计数、状态分布、标签和最近更新均可见；统计口径改为可读说明。 |
| `collection-intelligence-complete` | 360 CSS px | `collection-intelligence-complete-w360.png` (360×1281) | `40745e0c4dbe432d65fe71b019c277f6ebb411b658c7958d3c5ec54e62e4fd7b` | 无溢出；预期文案齐全；图片元素 0 | 360px：完整覆盖状态、计数、状态分布、标签和最近更新均可见；统计口径改为可读说明。 |
| `collection-intelligence-complete` | 520 CSS px | `collection-intelligence-complete-w520.png` (520×1170) | `d75b289aa9f43a275712cce40e19cc88135b3932eab8db6daaf6ae6bf411ae0b` | 无溢出；预期文案齐全；图片元素 0 | 520px：完整覆盖状态和统计层级完整；窄幅纵向阅读无横向溢出，最近更新时间与统计口径可读。 |
| `collection-intelligence-complete` | 640 CSS px | `collection-intelligence-complete-w640.png` (640×1154) | `189239f9d9bd2c9d28ea496663213cb5acdefb7aea5aa3d542bb3c28f220528e` | 无溢出；预期文案齐全；图片元素 0 | 640px：完整覆盖状态和统计层级完整；窄幅纵向阅读无横向溢出，最近更新时间与统计口径可读。 |
| `collection-intelligence-complete` | 960 CSS px | `collection-intelligence-complete-w960.png` (960×900) | `3cfccdce6ef1a2faa08766400e9406e19d0ccc760784e9d33e1a7c7bf88be226` | 无溢出；预期文案齐全；图片元素 0 | 960px：完整覆盖状态和统计层级完整；宽屏状态与评分图表分栏，最近更新时间与统计口径可读。 |
| `collection-intelligence-partial-long-script` | 320 CSS px | `collection-intelligence-partial-long-script-w320.png` (320×1511) | `b1616235ca3f484f8fe4ea570e7ee8426016a984329fad0ef454c85dcbb63856` | 无溢出；预期文案齐全；图片元素 0 | 320px：部分覆盖、源报告 80 条/观察 2 条和缺字段说明可见；没有原始字段名或成段红色告警。 |
| `collection-intelligence-partial-long-script` | 360 CSS px | `collection-intelligence-partial-long-script-w360.png` (360×1442) | `d8329dfca3e4f5efe3791b8f22fd0c72e805c431d97f7d46ac887d16da92c45d` | 无溢出；预期文案齐全；图片元素 0 | 360px：部分覆盖、源报告 80 条/观察 2 条和缺字段说明可见；没有原始字段名或成段红色告警。 |
| `collection-intelligence-partial-long-script` | 520 CSS px | `collection-intelligence-partial-long-script-w520.png` (520×1294) | `8cd03fe5e5181ba790f7d51e9ddf32309e8785ed8c9262883026e7b8a3109cf9` | 无溢出；预期文案齐全；图片元素 0 | 520px：部分覆盖与样本计数清楚；缺字段以短说明呈现，所有统计范围及不补猜口径都在卡片内。 |
| `collection-intelligence-partial-long-script` | 640 CSS px | `collection-intelligence-partial-long-script-w640.png` (640×1240) | `439d5f9fad60451b5c14af72926eaee226d1a56a707a158d31fa943dcdbb59e8` | 无溢出；预期文案齐全；图片元素 0 | 640px：部分覆盖与样本计数清楚；缺字段以短说明呈现，所有统计范围及不补猜口径都在卡片内。 |
| `collection-intelligence-partial-long-script` | 960 CSS px | `collection-intelligence-partial-long-script-w960.png` (960×927) | `0001ca583edc3db154827a8866796cc5ce8117b5976e0ba95b9f20ddd3106bea` | 无溢出；预期文案齐全；图片元素 0 | 960px：部分覆盖与样本计数清楚；缺字段以短说明呈现，所有统计范围及不补猜口径都在卡片内。 |
| `collection-intelligence-partial-empty` | 320 CSS px | `collection-intelligence-partial-empty-w320.png` (320×900) | `c6a1777e772788c0fdce6a63b8bb0e6fcec6fb8f2f862c6713bed560e30653eb` | 无溢出；预期文案齐全；图片元素 0 | 320px：清楚显示“本次未观察到”与“不能确认收藏为空”；成功读取 1/1 页，但源报告 3 条，不误报完整空收藏。 |
| `collection-intelligence-partial-empty` | 360 CSS px | `collection-intelligence-partial-empty-w360.png` (360×900) | `4ab9d2545fe17a7ebd1f9ab1e2e84877a5e047f86bf088ad2a0b8be1b2b2163b` | 无溢出；预期文案齐全；图片元素 0 | 360px：标题、源报告 3 条与成功读取 1/1 页的说明层级清楚，不能确认空集合的提示正常换行。 |
| `collection-intelligence-partial-empty` | 520 CSS px | `collection-intelligence-partial-empty-w520.png` (520×900) | `445c20d9642065125394a738881bfba516fd503108ab46567364c940fb493810` | 无溢出；预期文案齐全；图片元素 0 | 520px：部分空状态与来源计数分区明确；没有把 0 条观察样本改写成 0 条收藏。 |
| `collection-intelligence-partial-empty` | 640 CSS px | `collection-intelligence-partial-empty-w640.png` (640×900) | `a2e5cff4f589cfb5c8fc1ea59845ab74f1c6a47c1684d65d35a73f15bd87aa0b` | 无溢出；预期文案齐全；图片元素 0 | 640px：状态、来源计数与成功读取信息横向清楚；“不能确认”提示保留，留白与其他窄幅卡片一致。 |
| `collection-intelligence-partial-empty` | 960 CSS px | `collection-intelligence-partial-empty-w960.png` (960×900) | `52ddd2dcc54662b53b2c81447bdbf85769d5dba0b190e1fb2068cabc58e8a26f` | 无溢出；预期文案齐全；图片元素 0 | 960px：状态与来源计数在宽卡片内仍聚合成单一可扫读区块；不把超出观察范围的条目误报为成功空结果。 |
| `collection-intelligence-empty` | 320 CSS px | `collection-intelligence-empty-w320.png` (320×900) | `fb2c704d73f0607f454524a6c5bb309cf21b7b2ea8c96c60177b8a918066d035` | 无溢出；预期文案齐全；图片元素 0 | 320px：明确显示“暂无收藏条目”和完整空结果；没有将 0 条解释为服务失败。 |
| `collection-intelligence-empty` | 360 CSS px | `collection-intelligence-empty-w360.png` (360×900) | `ffa381a2621c0ff60032fd449cc13eead39465e61bd801bf473c17e93625746a` | 无溢出；预期文案齐全；图片元素 0 | 360px：明确显示“暂无收藏条目”和完整空结果；没有将 0 条解释为服务失败。 |
| `collection-intelligence-empty` | 520 CSS px | `collection-intelligence-empty-w520.png` (520×900) | `f7ebf56a89410763f0f31370779b9819581ccecd65d6270df059f3ed7980ffd9` | 无溢出；预期文案齐全；图片元素 0 | 520px：明确显示“暂无收藏条目”和完整空结果；没有将 0 条解释为服务失败。 |
| `collection-intelligence-empty` | 640 CSS px | `collection-intelligence-empty-w640.png` (640×900) | `c99641d37cf984b3e572d7a6af0375bc34fdafe9477b838c3e584c99fa5a9169` | 无溢出；预期文案齐全；图片元素 0 | 640px：明确显示“暂无收藏条目”和完整空结果；没有将 0 条解释为服务失败。 |
| `collection-intelligence-empty` | 960 CSS px | `collection-intelligence-empty-w960.png` (960×900) | `133df5458a0fce2d37a95a24add9a22ce0dfce98af58fe8cdace101830e47762` | 无溢出；预期文案齐全；图片元素 0 | 960px：明确显示“暂无收藏条目”和完整空结果；没有将 0 条解释为服务失败。 |
| `collection-intelligence-unavailable` | 320 CSS px | `collection-intelligence-unavailable-w320.png` (320×900) | `fabe36631e4f39973dd1bbfce8dd87921c3d21062bc606398ef274f94360ee63` | 无溢出；预期文案齐全；图片元素 0 | 320px：只有一条暂不可用提示，未知总数仍标作未知；没有重复错误文案或误报零收藏。 |
| `collection-intelligence-unavailable` | 360 CSS px | `collection-intelligence-unavailable-w360.png` (360×900) | `e631f351548c9216ee4372844c29661b77c186ec58b1f9f69a520ae288966ed6` | 无溢出；预期文案齐全；图片元素 0 | 360px：只有一条暂不可用提示，未知总数仍标作未知；没有重复错误文案或误报零收藏。 |
| `collection-intelligence-unavailable` | 520 CSS px | `collection-intelligence-unavailable-w520.png` (520×900) | `a6d24dc91c54a9732abbe026a6e554383e6f3127dcee0cdf27eb33a23d69bde2` | 无溢出；预期文案齐全；图片元素 0 | 520px：只有一条暂不可用提示，未知总数仍标作未知；没有重复错误文案或误报零收藏。 |
| `collection-intelligence-unavailable` | 640 CSS px | `collection-intelligence-unavailable-w640.png` (640×900) | `00973c3ceeadd2f3526ca7c198b4e611c29b308870d18ff57303588b6d13e813` | 无溢出；预期文案齐全；图片元素 0 | 640px：只有一条暂不可用提示，未知总数仍标作未知；没有重复错误文案或误报零收藏。 |
| `collection-intelligence-unavailable` | 960 CSS px | `collection-intelligence-unavailable-w960.png` (960×900) | `6638eec9317daf6cb02db3a676817f8f5976e338cb83add10a39eb22fc69f4c9` | 无溢出；预期文案齐全；图片元素 0 | 960px：只有一条暂不可用提示，未知总数仍标作未知；没有重复错误文案或误报零收藏。 |

## 覆盖边界与结论

在已打开的同路径旧版截图与当前合成候选之间，回调更明确地区分绑定成功、主动取消、状态无效和内部失败；进度卡保留 poster、收藏状态、集数、评分、评论及可计算时的进度，同时修复 320/360px 的卡片与断行。智能概览将原始 warning/limitation 代码压成可读说明，并保留来源计数。新增的部分空图片明确区分“0 条观察样本”和“完整空收藏”，避免假报。以上结论只涵盖上表逐张检查的页面和合成数据，不代表完整旧机器人功能 parity，也不代表 Agent 在真实对话中的消息组合或当前 QQ/TIM 客户端像素表现。UX-001 仍为 `ACTIVE 3/4`；真实账户与客户端证据待独立验收。
