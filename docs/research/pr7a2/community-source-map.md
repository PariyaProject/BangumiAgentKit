# Community source map

## 结论

PR-7A 的“没有官方 v0 community API”仍然成立，但不足以概括当前数据面。更准确的结论是：**S1 v0 / S2 current legacy 没有覆盖全部社区 capability；官方 frontend S3 private API 已提供 subject comments/reviews/topics、group topics/posts、trending topics 等结构化读面；S5 HTML 是网页 fallback 和部分可见编排来源。**

**FACT**：官方 private schema 和 live GET 覆盖 subjects comments/reviews/topics、group topics/replies、trending topics、blogs/index comments 等；旧 Rakuen HTML 仍可见。

**EVIDENCE**：[`frontend/packages/client/api.yaml`](https://github.com/bangumi/frontend/blob/master/packages/client/api.yaml)、[`bgm.tv/rakuen/topiclist?type=mono`](https://bgm.tv/rakuen/topiclist?type=mono)、[`bgm.tv/subject/41529/board`](https://bgm.tv/subject/41529/board)、[`bgm.tv/subject/41529/reviews`](https://bgm.tv/subject/41529/reviews)。

**REASONING**：community source 应按 capability/实体拆分，而不能以“有无一个 community API”二值判断。S3 的存在改善 feasibility，但 private API、正文权限、分页和条款仍使其成为隔离 Provider。

**CONFIDENCE**：endpoint existence HIGH；全站 coverage、排序/热度定义和法律可用性 LOW–MEDIUM。

**ALTERNATIVES**：部分 `/p1` endpoint 可能仅为新版 frontend 内部使用；旧 HTML 可能包含尚未暴露在 p1 的模块。单次页面 count 不能推出全站实时热度。

**IMPLEMENTATION IMPLICATION**：社区能力默认返回 `source`, `observedAt`, `coverage`, `parserVersion`, `termsReview`；没有快照时的增长问题必须 `NOT_COMPUTABLE`，不能用当前 count 代替历史。

## 逐项分类

| 社区面                       | S1/S2                               | S3                                    | S5                        | 结论                                        |
| ---------------------------- | ----------------------------------- | ------------------------------------- | ------------------------- | ------------------------------------------- |
| Rakuen 全站 topic stream     | 无完整 v0/legacy contract           | trending/topics surface 可补部分      | `/rakuen/topiclist*` 可见 | S3 preferred，S5 fallback，coverage unknown |
| subject board/topics/replies | 无统一 v0 board contract            | subject topics/posts endpoints        | `/subject/{id}/board`     | S3 structured + HTML fallback               |
| short comments/吐槽          | 无完整 v0 community contract        | subject/person/episode/index comments | comments 页面             | S3 structured，正文另审                     |
| long reviews                 | 无完整 v0 review contract           | subject reviews                       | reviews 页面              | S3 structured + S5; 不默认保存全文          |
| blogs / blog comments/photos | schema/路径不构成完整 current v0 面 | p1 blogs/comments/photos/related      | blog 页面                 | S3 opt-in，隐私/版权高风险                  |
| groups / topics / replies    | 无完整 v0 current contract          | groups, members, topics, posts        | group pages               | S3 structured + S5 fallback                 |
| index comments/related       | index raw能力有限                   | p1 index/comments/related             | index 页面                | S3 preferred                                |
| current trend                | 无 v0 heat contract                 | p1 trending subjects/topics           | Rakuen/排行 HTML          | source-native metric only；不得重命名为质量 |
| 7-day growth                 | 单次 API 不足                       | S3 可取当前 event fields              | HTML 可取可见 timestamp   | **S6 snapshot required**                    |

## 默认 provider 边界

- 允许 S3 GET：subject/community metadata、topic/review/comment pagination、group read、trending read；禁止所有 write。
- HTML 仅按 allowlist 请求；不全站爬取、不绕过登录/验证码/robots/访问控制。
- 默认只存计数、标题、时间、作者 public id/hash、URL；正文摘要/再分发另行审查。
- 429/403/5xx/schema mismatch 连续出现时停用该 community provider，不能阻塞 S1/S2 查询。
