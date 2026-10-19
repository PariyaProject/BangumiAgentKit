# Run #95 candidate visual QA — render_collection_backlog — 2026-10-19

## Scope and method

- Compared the pre-change renderer at base `c809dc810df6fc20c1cb1959ec8d2d163eeb3cd2` with the renderer implementation committed as `9f960a2e80968a425152cb3b87202c79f52da07e`. The final deterministic fixture runner is commit `95404f34c5a5c23ccb2be4198be6b75109731851`; this commit changed the fixture clock only, not the renderer.
- Used nine synthetic states (`complete`, `complete-empty`, `partial`, `partial-empty`, `dense`, `auth-required`, `permission-denied`, `rate-limited`, `upstream-error`) at 320/360/520/640/960 CSS px, device scale factor 1: 45 baseline and 45 candidate PNGs.
- Both runs used the same deterministic fixture content and frozen retrieval time `2026-10-19T00:00:00.000Z`. For baseline compatibility, the temporary runner omitted only assertions that inspect the new ViewModel presentation field; fixtures, mocked service calls, renderer, widths, and PNG recording were otherwise unchanged. Two candidate runs produced identical dimensions, byte lengths, and SHA-256 values for all 45 PNGs.
- All 90 baseline/candidate images were individually opened and compared. No clipping, horizontal spill, or footer overlap was observed. Synthetic private comments and fake cover URLs were not rendered. Each state matrix used 30 mocked fetches; external requests: 0.
- PNGs and manifests remain in ignored local artifacts; this tracked report records the paired dimensions and hashes without committing image binaries.

## Height comparison

| State | Base heights (320/360/520/640/960) | Candidate heights (320/360/520/640/960) | Height delta (candidate − base) |
| --- | --- | --- | --- |
| `complete` | 1582/1431/1075/985/745 | 1013/983/799/785/648 | -569/-448/-276/-200/-97 |
| `complete-empty` | 1137/1003/693/603/499 | 708/694/524/510/510 | -429/-309/-169/-93/+11 |
| `partial` | 1680/1530/1141/1051/794 | 1046/1032/831/817/681 | -634/-498/-310/-234/-113 |
| `partial-empty` | 1169/1035/726/636/532 | 708/694/524/510/510 | -461/-341/-202/-126/-22 |
| `dense` | 2608/2309/1660/1570/1181 | 2039/1860/1384/1370/1085 | -569/-449/-276/-200/-96 |
| `auth-required` | 1203/1098/783/708/618 | 626/611/471/471/471 | -577/-487/-312/-237/-147 |
| `permission-denied` | 1203/1080/783/708/618 | 626/611/471/471/471 | -577/-469/-312/-237/-147 |
| `rate-limited` | 1185/1080/783/708/618 | 626/611/471/471/471 | -559/-469/-312/-237/-147 |
| `upstream-error` | 1203/1098/783/708/618 | 626/611/471/471/471 | -577/-487/-312/-237/-147 |

Most cards are substantially shorter because detailed implementation prose, raw source class names, enum-like schedule details, and repeated warnings were removed from the image while remaining in the structured result. The complete-empty 960px card grows by 11px because it now contains a deliberate empty-state panel. The dense 320px case remains tall at 2039px because it contains ten rows, but every row and the footer remain visible in the image.

## Findings

- Complete-empty now says the current collection was fully read and no item matched the selected statuses; it suggests changing the filter or opening the collection overview. Partial-empty says unread items may still match and advises against treating the sample as an empty collection.
- Auth-required, permission-denied, rate-limited, and upstream failures each show one concise explanation and one next action. The rendered card omits machine error codes; the ViewModel retains the full error object.
- Partial populated output contains one schedule-coverage warning. Partial-empty relies on its dedicated state panel rather than repeating the same schedule failure below it.
- Full warnings, limitations, source operations, formula identifiers, retrieval time, coverage, item-level recovery data, and top-level error data remain available on the ViewModel. The renderer shows a concise four-line methodology summary.
- The card is text-only and does not add cover images. The private read-only boundary remains clear; this change did not alter service, OAuth, account, or write behavior.

## Legacy comparison

The pinned [Bangumi-for-QQ revision `b44d493`](https://github.com/Kurarion/Bangumi-for-QQ/tree/b44d493dd6f5044d6fe305292016908ae15ef933) uses a private authorization message/confirmation and image-led search/collection progression. The pinned [Bangumi-QQ-Bot-CPP revision `f1c75bc`](https://github.com/Kurarion/Bangumi-QQ-Bot-CPP/tree/f1c75bc366755d8bd7bf35ee5c11b513cb066f8e) presents collection/progress information with subject covers and structured text. Neither source audit found a direct derived-backlog-card equivalent. This comparison is limited to state clarity, next action, and hierarchy; it makes no whole-project parity or superiority claim. The legacy OAuth state/credential practices are not copied.

## Per-image receipt

| PNG | State | Base dimensions · SHA-256 | Candidate dimensions · bytes · SHA-256 | Individual inspection |
| --- | --- | --- | --- | --- |
| `complete-320.png` | `complete` | 320×1582 · `7c87c6bad728c8cda8e073c5805741d1314ab96af7b43ea262dbc42d5ff051e0` | 320×1013 · 99724 B · `460512f64c9c5edd6044f1049f5e966b7663debdff7caf69646673bba8ef8edc` | 完整覆盖的摘要、条目和口径均在卡片内；较基线删除重复源/实现术语，长标题换行正常。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `complete-360.png` | `complete` | 360×1431 · `00bd8406af139469281cc2afd7f3d348f4377fdc7e1285d7bbdd275bf28117ba` | 360×983 · 100759 B · `04c5090c0b576ec4f22c165520f76717947793ef155cbce25a1162305d1779ea` | 完整覆盖的摘要、条目和口径均在卡片内；较基线删除重复源/实现术语，长标题换行正常。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `complete-520.png` | `complete` | 520×1075 · `a6da1c04b28b01fde90466c711eed622d552f96ad400467e6d7d7645f7facb05` | 520×799 · 98217 B · `da06e5850f7ebc79a64ddf6a30c76521f9149aea662ac25b9be44389435a5094` | 完整覆盖的摘要、条目和口径均在卡片内；较基线删除重复源/实现术语，长标题换行正常。 520px：状态、条目与口径分区清楚，无裁切。 |
| `complete-640.png` | `complete` | 640×985 · `9fdb83c663f64ab80cbb7f2dcabf4333ce01e53296b254c490b6da748980908e` | 640×785 · 99831 B · `52d9d5e87b25c1882e2e3c92d6cd157406f0d4a8e719e7429f3dab5fe412d1fc` | 完整覆盖的摘要、条目和口径均在卡片内；较基线删除重复源/实现术语，长标题换行正常。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `complete-960.png` | `complete` | 960×745 · `1f4f74ce8a524656682f49915fab964985f94a30c09ff9a953a5740e01ad8992` | 960×648 · 102567 B · `fd17170239e9dd1bedf59bfe4b78aff120e1d26b0c7705bf0a0d96fc5f869396` | 完整覆盖的摘要、条目和口径均在卡片内；较基线删除重复源/实现术语，长标题换行正常。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `complete-empty-320.png` | `complete-empty` | 320×1137 · `2ff5a53e07e3441fe88391af13da7cc8a58b6ae15fc5c424c7274db83895b04a` | 320×708 · 75721 B · `121df7bcbec516f72e15c931572d6e8f8f713d388b26b958805ad29f6d675e4b` | 新增完整读取空状态和下一步；没有条目时可直接判断筛选范围内无结果。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `complete-empty-360.png` | `complete-empty` | 360×1003 · `4bc429cb9ffa1a44e5b5697dc9bc5da93e26fcdb36ce6ce43720eeb8e523c041` | 360×694 · 76174 B · `cd52dd978ec770d861bd4f9512afd88414c86a3b8a940768a3e628d86420d111` | 新增完整读取空状态和下一步；没有条目时可直接判断筛选范围内无结果。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `complete-empty-520.png` | `complete-empty` | 520×693 · `7447fb48e7cbc7931bac917fb741425d8a8f4933ba16dd15f15d127c2f87d05a` | 520×524 · 74218 B · `5f02bfdd455898aa216d76d0e2d4bb47eac0721b3b004ae57107820904bd36da` | 新增完整读取空状态和下一步；没有条目时可直接判断筛选范围内无结果。 520px：状态、条目与口径分区清楚，无裁切。 |
| `complete-empty-640.png` | `complete-empty` | 640×603 · `5732288d7f0235579828586a2859468e1ac6619a98abd38f0dd5100a2a1724c6` | 640×510 · 75340 B · `c28db78fb94d941db4e7004f5cde9ec9b9d188eea315e2d7fa77d371ccbf182d` | 新增完整读取空状态和下一步；没有条目时可直接判断筛选范围内无结果。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `complete-empty-960.png` | `complete-empty` | 960×499 · `2d150c2ca3b6a62afacedcec3d5ce9d8ea019cd03eb5aa5ca6082469599acfb6` | 960×510 · 78920 B · `c2d6e49fbc7ebfbcab95330b335a7af3ca374a26dd5be48391fd8ff07f13f931` | 新增完整读取空状态和下一步；没有条目时可直接判断筛选范围内无结果。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `partial-320.png` | `partial` | 320×1680 · `2847a6e12de03507c8407c92599449101559500935705643c2fa4487c236ba91` | 320×1046 · 105925 B · `2f48c06220a897ae2b02b88cfcc19cda24970df12c58e9185dad4c6574669cc3` | 部分覆盖标签、条目和单条计划未知提示都可见；明确未观察到不等于没有计划。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `partial-360.png` | `partial` | 360×1530 · `a02ed99c24673aa52f9fd2013f82b26a7aa15febcc5ff45dc3fa1ebc409fc9db` | 360×1032 · 106975 B · `b9ad78f1865736a821624015a44401f19750db1da92ea336b647f0eba81b472c` | 部分覆盖标签、条目和单条计划未知提示都可见；明确未观察到不等于没有计划。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `partial-520.png` | `partial` | 520×1141 · `5472a3d561b5c9c3553a08582021476787736474eccdf51f1690693ff6e961df` | 520×831 · 104135 B · `5f9185811a05548906ad5a8c1a8cd26935235b239df33af4ec391048c08b6219` | 部分覆盖标签、条目和单条计划未知提示都可见；明确未观察到不等于没有计划。 520px：状态、条目与口径分区清楚，无裁切。 |
| `partial-640.png` | `partial` | 640×1051 · `a5424fbb673c6f02d301bb542912f4a1d1c5df71f5ae5b3e07bc38196cbcd178` | 640×817 · 105973 B · `35fbee5b39c1e0fdac4522644a7832261914ccce4e34c3fafd23455a3ae1791f` | 部分覆盖标签、条目和单条计划未知提示都可见；明确未观察到不等于没有计划。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `partial-960.png` | `partial` | 960×794 · `f265b521ac574dd0c4401666f9b20a172aa845134d4c02b179d82669397cdc63` | 960×681 · 108626 B · `c9cd99dfba46592aa34efe09b429925673190b1012f064b2823f19cec553878b` | 部分覆盖标签、条目和单条计划未知提示都可见；明确未观察到不等于没有计划。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `partial-empty-320.png` | `partial-empty` | 320×1169 · `481fc15b3452be910e00116347d431b37ae4c5c87b84b7509b22da442dcb330e` | 320×708 · 74043 B · `38e155dff995778bd7c5d67d190552e8ede3cfe9e5be0d6b83120c2bba813cb5` | 新增部分空状态，明确未读收藏仍可能有条目；不再追加重复的计划失败警告。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `partial-empty-360.png` | `partial-empty` | 360×1035 · `7976540a4429db6213c8da072f71c5fd488bcbb489fab33f6274d42e0b19142e` | 360×694 · 74903 B · `1ed6670008cc1fd105666087f9a67549d7278f52765aec57f260f51a2818dadc` | 新增部分空状态，明确未读收藏仍可能有条目；不再追加重复的计划失败警告。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `partial-empty-520.png` | `partial-empty` | 520×726 · `e4afbd078938b21728a6ce581190d81c515b3f5ae5a1ca0d9b4bbfbcc4f28674` | 520×524 · 72668 B · `92db373643a224ddec3b0ff2a28c94d7b91cb2670ae0b41c7ebe46927bc61659` | 新增部分空状态，明确未读收藏仍可能有条目；不再追加重复的计划失败警告。 520px：状态、条目与口径分区清楚，无裁切。 |
| `partial-empty-640.png` | `partial-empty` | 640×636 · `e4848da130506756d2ce3cd0c4810b94aa21f9182d40456843b43b6c985b3b8c` | 640×510 · 73757 B · `a198ecf5d17da8401de08b4f9ffbe46e1d5f0200f336561c681707e0ecc941c3` | 新增部分空状态，明确未读收藏仍可能有条目；不再追加重复的计划失败警告。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `partial-empty-960.png` | `partial-empty` | 960×532 · `36b6a733bdc26cf79a9660f8f7b77142e09e6f76b3b9ba658f07208fe217c95c` | 960×510 · 77301 B · `5755b133a2c3372016ea834abe1a17e897a037315d3de1ac0d437a9a059086ab` | 新增部分空状态，明确未读收藏仍可能有条目；不再追加重复的计划失败警告。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `dense-320.png` | `dense` | 320×2608 · `5d387ef095526fcede02e80fecd4e16e1f2ddbfa17ecbc528d334663932338b2` | 320×2039 · 270988 B · `f401687f0fd8997600288295076cb2fd177ab65b0e16928d64d8cc59260d216a` | 10 条合成收藏均显示；摘要、条目分隔、口径和页脚连续可见，长标题换行正常。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `dense-360.png` | `dense` | 360×2309 · `54e501497d0b4b9c0f7727660294c624d9dbe27b691d0e198e414a0433a6371d` | 360×1860 · 276160 B · `1e66d508fea08bc9092c9e328712c4ec80f5a4db1238e8b4a10dc6a41ba8488a` | 10 条合成收藏均显示；摘要、条目分隔、口径和页脚连续可见，长标题换行正常。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `dense-520.png` | `dense` | 520×1660 · `9a6a999b5ab15102a04dc4316bfc74d548d350ea213b7ebc2aa72066e9ad4f85` | 520×1384 · 262898 B · `4511204346e9fb71df91fa66b7e0d7563eaf9535afa5e5236b8a404bc843e2b7` | 10 条合成收藏均显示；摘要、条目分隔、口径和页脚连续可见，长标题换行正常。 520px：状态、条目与口径分区清楚，无裁切。 |
| `dense-640.png` | `dense` | 640×1570 · `9acc822ba7a662c33c3ceb5d1d724416d256d6f4e38037aca7c3af08022f7991` | 640×1370 · 269154 B · `71fc2756fc210f35e995a01cacc9c899caa1d5e627b9b9569bd29d55aff51100` | 10 条合成收藏均显示；摘要、条目分隔、口径和页脚连续可见，长标题换行正常。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `dense-960.png` | `dense` | 960×1181 · `a3d86a37665e563818709fa4de2503e762ab951a1c7c3e6d857dfdf16d26f6f7` | 960×1085 · 274367 B · `a7d91eb13a9e4fb10b6003940537d2bbe17e1707b6a36903908da028b8ee6f55` | 10 条合成收藏均显示；摘要、条目分隔、口径和页脚连续可见，长标题换行正常。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `auth-required-320.png` | `auth-required` | 320×1203 · `8fe6afe28d4c3edcaa2147bb5b72a981e3f795c4074d530340ef77ccf781ab14` | 320×626 · 60040 B · `765795583a2134514f1d3d908a4be365f2f85c4c3cff1af49399f53e083a4756` | 只显示账号未绑定及绑定后重试；无重复解释或机器错误码。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `auth-required-360.png` | `auth-required` | 360×1098 · `8687a9bb38e2f26ec71aa679058a23be2d8a1f7300bfc1a6cab1db2e2c35f645` | 360×611 · 60754 B · `50bdad34348b65576e4ee724538c617889ffdfa5bc86cb8ca48f3303916a4afd` | 只显示账号未绑定及绑定后重试；无重复解释或机器错误码。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `auth-required-520.png` | `auth-required` | 520×783 · `c29290321c1a7bdaee182d5d8db87258877f4b563fa34e912d4cc0006f2ef611` | 520×471 · 58760 B · `a38715395299817cd3a679be2263f93cb98b286d8f57f3ae1873a7e0effc3aff` | 只显示账号未绑定及绑定后重试；无重复解释或机器错误码。 520px：状态、条目与口径分区清楚，无裁切。 |
| `auth-required-640.png` | `auth-required` | 640×708 · `d90b03f91f1ed248c5be8acfe9a32cde5eba0a9e595a8cc1d0d9e7a758e4315f` | 640×471 · 59884 B · `bf758a12633a055ce308341f26c9d719363dc77dfec164d0d21394cbd88a964f` | 只显示账号未绑定及绑定后重试；无重复解释或机器错误码。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `auth-required-960.png` | `auth-required` | 960×618 · `2af2786eaeeb30174f54d5353c74e812c11f834f9f1e891cefeaa46a56d83053` | 960×471 · 63008 B · `2bdb574fa8f5f99d3ae11e6765d0545e7ac5369c254ecfdec2d2d6b76186b40f` | 只显示账号未绑定及绑定后重试；无重复解释或机器错误码。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `permission-denied-320.png` | `permission-denied` | 320×1203 · `bc2492d4d3b5c81ecc604ea41d24f976cb83e0a1257ebf140d408f57022cb7ef` | 320×626 · 61791 B · `cb4da39b68b67740805b6874fce52d4f4f82e795b1fed620a56c8bf3ef7642cf` | 只显示收藏读取权限不足及确认授权范围后重试；无重复解释或机器错误码。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `permission-denied-360.png` | `permission-denied` | 360×1080 · `7bd8026ee496f58681504e93826ad27ab4a693c814fc8521cdb79a5d9d31c0b7` | 360×611 · 62596 B · `5370e468396db62d3eab287cf1bbd05cdbdaeb872b521203d22e9a24b4a438b8` | 只显示收藏读取权限不足及确认授权范围后重试；无重复解释或机器错误码。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `permission-denied-520.png` | `permission-denied` | 520×783 · `067d7c2c2cf9b8f76ad8f3f4cc13206fe45cd7076b39614b4a56af6ca4ebaca7` | 520×471 · 61413 B · `44c6befe11284f16471d01eba0128163dcf538754b0eb08d8148378871a2fb0c` | 只显示收藏读取权限不足及确认授权范围后重试；无重复解释或机器错误码。 520px：状态、条目与口径分区清楚，无裁切。 |
| `permission-denied-640.png` | `permission-denied` | 640×708 · `9ddd82cf64b46f2d67f7fc1f1507f8fe7c1d29bea79857f7e68924614571e8bc` | 640×471 · 62588 B · `ed5cc52a6f19fb76315abf1701ea8bbe095590adef95e9d1390359f4cb11467c` | 只显示收藏读取权限不足及确认授权范围后重试；无重复解释或机器错误码。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `permission-denied-960.png` | `permission-denied` | 960×618 · `f380533abb2f520dee761a07e43d168d1f49a4ba3b2a25af5997d0d574da1251` | 960×471 · 65842 B · `4518abe320f715ba14b82e450335a1843600bfbce76ffc96c72f500daab08122` | 只显示收藏读取权限不足及确认授权范围后重试；无重复解释或机器错误码。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `rate-limited-320.png` | `rate-limited` | 320×1185 · `9acd4d2fd07d1021f29ce14ee632bc9847b2eced773267d856b51e465532dc31` | 320×626 · 60374 B · `168d812e67f5275ddf267600519d200a53f20c6fad250a159d1eb50139d25a02` | 只显示 Bangumi 限制读取及稍后重试；无重复解释或机器错误码。 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `rate-limited-360.png` | `rate-limited` | 360×1080 · `e7c8f0fef7be826bff0171aa1c4951f607ab8a830aff7fd00a15d12207bcf103` | 360×611 · 60945 B · `b8567c6b2c258bc533ca2ef434b87422ee46621044b8f0c8a266197d27ca469e` | 只显示 Bangumi 限制读取及稍后重试；无重复解释或机器错误码。 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `rate-limited-520.png` | `rate-limited` | 520×783 · `d42cd63277f687a3b89ba04eaef9b5fa337fa5030c847c4b69c97a9a30c2fa7f` | 520×471 · 59043 B · `97b213bdad08ab2f6dac9f6de934f6002e19b9d2f1a67bdfea0a3903e8e105cf` | 只显示 Bangumi 限制读取及稍后重试；无重复解释或机器错误码。 520px：状态、条目与口径分区清楚，无裁切。 |
| `rate-limited-640.png` | `rate-limited` | 640×708 · `b8823a052d70d2f91b484598025705f0ffb60019881bcb2a8ecbd104acac9eb3` | 640×471 · 60132 B · `2095cb70787bd9498e22c1d5e4f2cc0539101d4f68d7e9be9e7b8f6ac95862df` | 只显示 Bangumi 限制读取及稍后重试；无重复解释或机器错误码。 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `rate-limited-960.png` | `rate-limited` | 960×618 · `3f278c056b18b2912d2bc44fea2c1247b8eb4a42af7ec5edb7760863cbea8029` | 960×471 · 63315 B · `cb7d8baf43b60ed388734d662f9c86b86821220cdf5a915ffab0c6c97701528a` | 只显示 Bangumi 限制读取及稍后重试；无重复解释或机器错误码。 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |
| `upstream-error-320.png` | `upstream-error` | 320×1203 · `c85c73b75ab2d5f246ece8a241d53987e6ec97e85510175ffb8b826dc24950c2` | 320×626 · 61153 B · `ec81aa41475a3279d6281d66760d7fbaf731db0c0054c8d7d04ac3d2b74761aa` | 只显示暂时无法读取收藏及稍后重试；无重复解释或机器错误码. 320px 窄屏：内容自然换行，无横向溢出或边缘裁切。 |
| `upstream-error-360.png` | `upstream-error` | 360×1098 · `2543a3e53fb37feafeccbfbcfb2e8bc3d9461d51f3057121cea0f03466814a7f` | 360×611 · 61411 B · `d47cfe542e261c287beaa191350a548c54fabb458f33ff8848abc5f45adb3eac` | 只显示暂时无法读取收藏及稍后重试；无重复解释或机器错误码. 360px 窄屏：摘要仍为两列，标题和说明完整。 |
| `upstream-error-520.png` | `upstream-error` | 520×783 · `de409b83f6e3d9d70d22e4b4cc21d830b2144379a52e913d7a3c9334841a8134` | 520×471 · 59845 B · `df2edec8d6f7c56e54ed2c9d2f4531fd230834fe76dd422604d821c3615ac3ee` | 只显示暂时无法读取收藏及稍后重试；无重复解释或机器错误码. 520px：状态、条目与口径分区清楚，无裁切。 |
| `upstream-error-640.png` | `upstream-error` | 640×708 · `075991f105c4b2654a9d6248daf43a8ffe0990a181560572b79a9b95052b466b` | 640×471 · 60913 B · `d32ac9442a9fdbbbec85457222b478a91059f5f9f7f0cc8d85b151bf6536acbf` | 只显示暂时无法读取收藏及稍后重试；无重复解释或机器错误码. 640px：摘要、主内容与页脚间距正常，无裁切。 |
| `upstream-error-960.png` | `upstream-error` | 960×618 · `919edfca07a726cb968ab34f8b3daae4b19064d5842733c0d2c973d7df623eb9` | 960×471 · 64128 B · `74a928f88c4e0cca0ab2bc2f4ebc53d53949427d67de41b52c8b5aae3d888dd0` | 只显示暂时无法读取收藏及稍后重试；无重复解释或机器错误码. 960px 宽屏：摘要按四列排列，主内容和页脚仍在卡片边界内。 |

## Acceptance boundary

This is offline synthetic renderer evidence only. It adds no real OAuth consent, account-to-Agent composition, personalized message, QQ/TIM delivery, Agent/MCP, or acceptance-matrix credit. OP-009 remains `PARTIAL`; Run #95 counters remain Agent/MCP 83/96, public API 65/65, no-account denial 22/22, QQ/TIM 0/96.
