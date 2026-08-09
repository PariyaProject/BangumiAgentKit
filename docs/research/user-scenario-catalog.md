# Bangumi 用户场景目录

> PR-7A 研究交付物。共 103 个非 CRUD 用户问题：30 个 release-level golden scenarios，加上按 DISCOVERY / COMPARISON / PERSON / SEIYUU / STAFF / COMMUNITY / STATISTICS / COLLECTION / PERSONAL / RELATION GRAPH / CONTENT 分类的 73 个扩展场景。

## 口径

- “当前支持”只表示现有 semantic tool 或固定 API 能直接、稳定回答；raw operation 拼接或人工浏览不算完整支持。
- “未来工具”是产品语义名称，不是本次实现承诺。
- 需要 HTML、历史快照或用户授权的场景必须在结果里返回 source、retrievedAt、freshness、auth scope 和 confidence。

## 30 个 release-level golden scenarios

|  ID | 类别           | 用户问题                                                               | 必需数据                                                                                  | 当前支持                                                          | 主要缺口                                       | 建议未来工具                       | 建议 Renderer                       |
| --: | -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------- | ----------------------------------- |
| G01 | DISCOVERY      | 今年七月番中的后宫动画有哪些？                                         | 当年 7 月季/air_date、anime type、精确/候选标签、名称和来源                               | calendar 可看日程；search 缺日期/tag filter                       | 月份 + 概念解析 + 可解释过滤                   | `query_subjects`                   | SearchResults + SeasonRanking       |
| G02 | DISCOVERY      | 2024年最热门的10部异世界动画。                                         | 2024 date、anime、异世界概念、heat 排序、Top 10                                           | search 有 heat，但没有 date/tag                                   | 高级 filter 和概念不等价问题                   | `query_subjects`                   | SearchResults                       |
| G03 | DISCOVERY      | 近5年评分8.0以上且评分人数超过5000的原创动画。                         | air_date range、rating、rating_count、原创 tag/来源、anime                                | subject/search 有原始字段；semantic 未暴露 predicates             | 复合条件和“原创”解析                           | `query_subjects`                   | SearchResults + Stats               |
| G04 | SEIYUU         | 水濑祈过去12个月参与了多少部TV动画配音？                               | person identity、person→character→subject、role/CV、TV、air date window、去重             | `get_person` 可拿关系；需多跳手工计算                             | 时间窗口、媒体/角色口径、去重                  | `voice_actor_workload`             | PersonWorkload                      |
| G05 | SEIYUU         | 水濑祈最近半年工作量和之前半年相比如何？                               | 两个连续 6 月窗口、作品数、角色数、主/配角、TV-only、缺失日期                             | 无聚合                                                            | 无快照/聚合/比较输出                           | `voice_actor_workload`             | PersonWorkload                      |
| G06 | SEIYUU         | 少女终末旅行完整主要角色/CV。                                          | subject、characters、role=main、actor/person、排序和证据                                  | `get_subject_cast` 可取得关系                                     | semantic 未固定 main/support 语义和完整分页    | `get_subject_cast` v2              | Cast                                |
| G07 | STAFF          | 少女终末旅行主要制作人员。                                             | subject→persons、职位、person identity、职位分组                                          | raw API 可读 subject persons；无独立 semantic staff               | 职位分组/显示排序                              | `get_subject_staff`                | Staff                               |
| G08 | STATISTICS     | 少女终末旅行评分分布和完成率。                                         | rating histogram、collection state、completion definition、retrievedAt                    | `get_subject` 只有摘要                                            | v0 无分布/完成率全量                           | `subject_stats`                    | Stats                               |
| G09 | RELATION GRAPH | 少女终末旅行系列观看顺序。                                             | subject relations、relation types、series graph、order policy                             | `get_subject_relations` 给边                                      | 无图遍历/观看顺序规则                          | `series_watch_order`               | Relations                           |
| G10 | COMMUNITY      | 当前 Bangumi 讨论热度最高的10部动画。                                  | Rakuen/board/topic count、heat definition、anime mapping、snapshot time                   | 无 community API                                                  | HTML provider、热度口径、缓存                  | `community_trending`               | CommunityTrending                   |
| G11 | COMMUNITY      | 过去7天讨论增长最快的动画。                                            | 至少两次 7 日快照、topic/reply/comment counts、subject mapping                            | 无历史快照                                                        | 没有历史事件数据时不可计算                     | `community_trend`                  | CommunityTrending                   |
| G12 | PERSONAL       | 我的在看作品本周更新计划。                                             | authenticated username、doing collections、calendar/episodes、air dates、episode progress | calendar 与 collection 可分开读；不能语义合并                     | 认证 episode read 和 join                      | `my_weekly_schedule`               | CollectionDashboard                 |
| G13 | COLLECTION     | 我收藏但已经完结且没看完的动画。                                       | my collections、subject total episodes/status、episode progress、completion rule          | collection/subject 可读；自己的 episode progress read 缺 semantic | auth boundary 和“完结/没看完”定义              | `collection_backlog`               | CollectionDashboard                 |
| G14 | DISCOVERY      | 今年春季评分最高的原创 TV 动画，按评分人数打破平分。                   | season range、TV、original concept、score、rating_count、tie-break                        | 部分可 raw                                                        | typed sort/filter 与解释                       | `query_subjects`                   | SeasonRanking                       |
| G15 | COMPARISON     | 《葬送的芙莉莲》和《药屋少女的呢喃》在评分、集数、完成率上有什么差异？ | two subject details、rating/collection/stats/episodes                                     | detail 可对比基础字段                                             | stats 与标准化字段缺失                         | `compare_subjects`                 | SubjectDeepDive                     |
| G16 | PERSON         | 某导演过去三年执导过哪些 TV 动画？                                     | person career/role、subject air date/platform/type                                        | person relationships 可读                                         | role filter、日期聚合、媒体判定                | `staff_activity`                   | PersonProfile + SearchResults       |
| G17 | STAFF          | 这部作品的原作、导演、脚本和音乐分别是谁？                             | subject persons grouped by relation                                                       | API relationship raw 可用                                         | semantic 职位视图                              | `get_subject_staff`                | Staff                               |
| G18 | SEIYUU         | 哪些声优同时出演了这两部动画？                                         | each subject cast、person identity normalization、role                                    | 两边 cast 可手工取得                                              | intersection semantic                          | `compare_cast`                     | Cast                                |
| G19 | PERSON         | 这个人物最近参与的作品中，哪些是原创、哪些是改编？                     | person works、source tags/infobox、concept evidence                                       | API 有 subjects/tags                                              | “原创”不是统一 API 字段                        | `person_works` + `concept_resolve` | PersonProfile                       |
| G20 | RELATION GRAPH | 某系列中哪些作品是前传、续作、外传，应该按什么顺序看？                 | directed relation edges、dates、series membership、ambiguity                              | edges 可用                                                        | relation label normalization/order policy      | `series_watch_order`               | Relations                           |
| G21 | COMMUNITY      | 这部动画最近一周新增了多少主题和回复？                                 | board/Rakuen snapshots、time window、subject key                                          | 无                                                                | HTML + snapshot delta                          | `community_trend`                  | CommunityTrending                   |
| G22 | COMMUNITY      | 讨论最多但评分人数较少的作品有哪些？                                   | community counts + subject rating_count/score、thresholds                                 | 两侧需不同来源                                                    | join/provenance and bias warning               | `community_trending`               | CommunityTrending + Stats           |
| G23 | STATISTICS     | 一部作品的评分是集中在 8–9 分还是两极分化？                            | score histogram、sample size、mean/stddev                                                 | stats page HTML only                                              | histogram extraction and confidence            | `subject_stats`                    | Stats                               |
| G24 | COLLECTION     | 我的“想看”里哪些已经完结，哪些还在连载？                               | current collection + subject date/eps/air status                                          | list collection + subject                                         | completion/airing classifier                   | `collection_backlog`               | CollectionDashboard                 |
| G25 | PERSONAL       | 根据我的完成作品，我最常看的题材和制作人员是什么？                     | private/public collection, tags, persons, weighted counts                                 | public list can be read; personal aggregation absent              | taste model and privacy                        | `user_taste_profile`               | CollectionDashboard                 |
| G26 | DISCOVERY      | 找出 2019–2024 年评分人数超过 1 万的女性向 TV 动画。                   | date range、type/platform/concept、rating_count                                           | search fields incomplete                                          | concept resolver + high-cardinality pagination | `query_subjects`                   | SearchResults                       |
| G27 | CONTENT        | 某条目每一集的中文标题、首播日期和时长是什么？                         | episodes name_cn/airdate/duration、ordered list                                           | `get_episodes` supports                                           | renderer/text length only                      | `episode_list`                     | SubjectDeepDive                     |
| G28 | CONTENT        | 这部动画有没有 OVA、SP、OP/ED 或特别篇？                               | episode type classification, list, relation                                               | get episodes has type                                             | semantic category/filter and display           | `episode_list`                     | SubjectDeepDive                     |
| G29 | STAFF          | 找出和某导演合作次数最多的编剧，并列出共同作品。                       | staff edges over subjects, roles, unique subjects, count                                  | API supports raw graph traversal                                  | aggregation/normalization                      | `person_activity_analysis`         | PersonProfile                       |
| G30 | COMMUNITY      | 这个条目的长评、短评和讨论板分别反映了什么主题？                       | comments/reviews/board metadata or sampled text, provenance, privacy                      | no official API                                                   | provider, summarization boundary, bias         | `community_summary`                | CommunityTrending + SubjectDeepDive |

## 扩展场景：DISCOVERY（7）

|  ID | 用户问题                                              | 需要的数据/判断                                                   |
| --: | ----------------------------------------------------- | ----------------------------------------------------------------- |
| D01 | 最近一年评分人数增长最快的原创动画有哪些？            | subject snapshots、rating_count delta、original concept、时间窗口 |
| D02 | 适合喜欢《少女终末旅行》的低刺激末世旅行动画有哪些？  | 相似主题/标签、关系或语义候选；必须标注推荐依据而非假装官方相似度 |
| D03 | 2020 年以后没有续作、但已经完结的短篇 TV 动画有哪些？ | series graph、episode total、air status、date range               |
| D04 | 找出集数少于 13、评分人数超过 3000 的科幻动画。       | eps、rating_count、tag、anime type                                |
| D05 | 本季同时满足“校园”和“恋爱”标签的作品按热度列出。      | season date、tag AND、heat、label evidence                        |
| D06 | 有中文名但没有日文名的动画条目有哪些？                | subject name/name_cn completeness、media type                     |
| D07 | 过去十年每年排名第一的动画是什么？                    | yearly snapshots/rank；需要定义按哪一套排名和历史数据来源         |

## 扩展场景：COMPARISON（7）

|  ID | 用户问题                                                 | 需要的数据/判断                                          |
| --: | -------------------------------------------------------- | -------------------------------------------------------- |
| C01 | 两部作品的评分人数差多少，差异是否足够大？               | rating、rating_count、阈值和统计解释                     |
| C02 | 同一原作的 TV 版和剧场版在集数、评分、收藏量上差异如何？ | series/relations、subject fields、normalized metrics     |
| C03 | 两位声优在共同作品数量和主役比例上谁更高？               | person-character edges、role classifier、unique subjects |
| C04 | 两个季度的原创动画热度和评分哪个更高？                   | season cohorts、heat/score、sample-size caveat           |
| C05 | 同一导演的早期和近期作品，评分趋势是否变化？             | person→subjects、date bins、scores and snapshots         |
| C06 | 这两部作品的主要制作团队重合度是多少？                   | staff/person sets、role weights、overlap definition      |
| C07 | “收藏多但评分低”和“评分高但收藏少”的作品各有哪些？       | collection/rating metrics、分箱规则、sampling bias       |

## 扩展场景：PERSON（7）

|  ID | 用户问题                                     | 需要的数据/判断                                    |
| --: | -------------------------------------------- | -------------------------------------------------- |
| P01 | 这位人物最常担任哪些职位？                   | person→subject staff roles、role normalization     |
| P02 | 某人物首次参与动画和最近参与动画分别是什么？ | work dates、missing-date policy                    |
| P03 | 某人物参与的作品里，哪些拥有中文译名？       | person works、name/name_cn completeness            |
| P04 | 这位人物与哪些人合作最频繁？                 | co-credit graph、unique subject dedupe、role scope |
| P05 | 某人物作品按媒介分布如何？                   | subject type/platform、media normalization         |
| P06 | 某人物最近 20 个作品中哪些仍在连载？         | air status/date、pagination、current retrieval     |
| P07 | 某人物的作品是否集中在某些标签或季节？       | tags、time bins、coverage and missing-tag bias     |

## 扩展场景：SEIYUU（7）

|  ID | 用户问题                                 | 需要的数据/判断                                              |
| --: | ---------------------------------------- | ------------------------------------------------------------ |
| S01 | 某声优过去三年每年配音多少部 TV 动画？   | person-character-subject graph、air_date、annual windows     |
| S02 | 某声优主役作品中评分最高的五部是什么？   | role=main、score/rank、tie-break                             |
| S03 | 某声优是否同时出演了一个系列的多部作品？ | series relation graph、cast intersection                     |
| S04 | 哪些作品由同一声优配音多个主要角色？     | subject characters/actors、role and duplicate character rule |
| S05 | 某声优最近半年有没有只参与非 TV 媒介？   | media/platform classification、excluded media evidence       |
| S06 | 某声优的合作网络中，哪三位共同作品最多？ | co-credit aggregation、count definition                      |
| S07 | 某声优的工作量峰值出现在什么月份？       | monthly buckets、air-date completeness、release-date policy  |

## 扩展场景：STAFF（6）

|  ID | 用户问题                                           | 需要的数据/判断                                        |
| --: | -------------------------------------------------- | ------------------------------------------------------ |
| T01 | 某动画的导演还执导过哪些同类型作品？               | staff relation、tags/concepts、person work graph       |
| T02 | 某编剧参与的作品按原创/改编分组是什么样？          | staff role、concept resolver、source/infobox evidence  |
| T03 | 同一制作人员连续合作的团队有哪些？                 | person co-credit graph、time sequence                  |
| T04 | 某系列每一部的音乐制作人员是否相同？               | series edges、staff role=music、identity normalization |
| T05 | 某职位在近五年参与作品数量的趋势如何？             | person activity、role filter、year/month bins          |
| T06 | 这部作品的人物设定、总作画监督和作画监督分别是谁？ | subject persons、fine-grained relation labels          |

## 扩展场景：COMMUNITY（7）

|  ID | 用户问题                               | 需要的数据/判断                                              |
| --: | -------------------------------------- | ------------------------------------------------------------ |
| M01 | 当前哪个条目的讨论最活跃？             | Rakuen/topiclist、subject mapping、heat definition           |
| M02 | 某条目最近 24 小时是否出现新讨论？     | topic timestamps、retrieval boundary、HTML freshness         |
| M03 | 哪些作品过去 7 天回复数增长最多？      | snapshots、reply delta、subject join                         |
| M04 | 某小组最近讨论的主题集中在哪些作品？   | group topics、entity extraction、provenance                  |
| M05 | 哪些条目评论很多但长评很少？           | comments/reviews counts、page coverage                       |
| M06 | 某条目讨论板的未解决争议主题有哪些？   | topic/reply text or titles、summarization limits、bias       |
| M07 | 最近更新的用户目录里有哪些高质量专题？ | index update time、subject count/metadata、quality heuristic |

## 扩展场景：STATISTICS（6）

|  ID | 用户问题                                         | 需要的数据/判断                                                       |
| --: | ------------------------------------------------ | --------------------------------------------------------------------- |
| A01 | 某动画的评分标准差是否明显高于同季平均？         | subject stats、season cohort、sample size                             |
| A02 | 评分人数超过多少后排名才比较稳定？               | historical rank/rating snapshots；需明确为研究估计                    |
| A03 | 一个作品的收藏状态分布是否偏向“想看”还是“看过”？ | collection buckets、completion rule                                   |
| A04 | 某季度动画的平均集数和平均评分是多少？           | season subject cohort、episodes/score、missing values                 |
| A05 | 哪些条目评分高但完成率低？                       | score + completion rate、HTML stats or provider                       |
| A06 | 用户注册年份是否影响某作品评分？                 | stats page distribution or privacy-safe aggregate；需谨慎防止过度推断 |

## 扩展场景：COLLECTION（7）

|  ID | 用户问题                                   | 需要的数据/判断                                                     |
| --: | ------------------------------------------ | ------------------------------------------------------------------- |
| L01 | 我的在看列表中本周会更新哪些集？           | authenticated collections + calendar + episode metadata             |
| L02 | 我的搁置列表里哪些作品已经完结？           | collection state + air/episode status                               |
| L03 | 我收藏的作品中哪些评分低于 7 但评论很多？  | private/public boundary + rating + community counts                 |
| L04 | 某用户收藏最多的标签是什么？               | public collection + tags + count normalization                      |
| L05 | 我的收藏里哪些属于同一系列？               | collection subjects + relation graph                                |
| L06 | 我还有多少未完成集数？                     | authenticated episode collection + total episodes + specials policy |
| L07 | 我的角色和人物收藏是否与我的作品收藏一致？ | user character/person collections + subject collection + graph join |

## 扩展场景：PERSONAL（6）

|  ID | 用户问题                                         | 需要的数据/判断                                                            |
| --: | ------------------------------------------------ | -------------------------------------------------------------------------- |
| U01 | 根据我的近两年收藏，我更偏爱哪些季度？           | collection timestamps/air dates、season bins                               |
| U02 | 我评分最高的作品里哪些制作人员重复出现？         | user ratings + staff graph                                                 |
| U03 | 我最近半年抛弃的作品有什么共同标签？             | collection history, if available; current API lacks historical transitions |
| U04 | 我没有收藏但与我的高分作品关系最近的系列有哪些？ | relation graph + taste profile + candidate explanation                     |
| U05 | 我的在看清单按预计观看时间怎么排？               | remaining episodes × duration + schedule + confidence                      |
| U06 | 我给低分的作品是否集中在某些类型？               | ratings + tags/type、selection bias warning                                |

## 扩展场景：RELATION GRAPH（6）

|  ID | 用户问题                                         | 需要的数据/判断                                     |
| --: | ------------------------------------------------ | --------------------------------------------------- |
| R01 | 某作品的所有前传、续作和外传是什么？             | relation edge traversal、dedupe                     |
| R02 | 哪些系列存在多条改编链？                         | subject graph、relation labels、cycle handling      |
| R03 | 从一部作品出发，两跳内评分最高的关联作品是什么？ | graph traversal + subject scores                    |
| R04 | 某系列是否有剧场版必须插入 TV 观看顺序？         | relation type + date + order policy                 |
| R05 | 两个作品之间是否通过系列或人物相连？             | subject/person/character heterogeneous graph        |
| R06 | 哪些作品共享最多的主要角色配音者？               | cast graph、main-role filter、weighted intersection |

## 扩展场景：CONTENT（7）

|  ID | 用户问题                                         | 需要的数据/判断                                          |
| --: | ------------------------------------------------ | -------------------------------------------------------- |
| C08 | 某作品的总集数和已播集数是否一致？               | subject eps/total_episodes + episode list + current date |
| C09 | 哪些集是特别篇而不是正篇？                       | episode type taxonomy                                    |
| C10 | 某作品每集的首播日期是否有空缺或冲突？           | episode airdate validation + revision evidence           |
| C11 | 某条目的别名、中文名和平台名称有哪些？           | subject names/infobox/aliases/links                      |
| C12 | 某作品有哪些推荐目录和主题索引？                 | index membership; v0 needs index IDs or HTML discovery   |
| C13 | 某条目最近一次资料修改改了什么？                 | revision list/detail and diff-friendly data              |
| C14 | 某角色的出演作品和 CV 是否有重复或同名实体风险？ | character/person relations + identity resolution         |

## Golden 场景验收规则

每个 G 场景在进入实现前应具备：

1. 输入中的时间、媒体类型、概念、排序、数量和认证范围均可序列化。
2. 结果每行能追溯到官方 API、HTML 快照或派生计算，并暴露检索时间。
3. 数据不够时返回“无法计算/证据不足”及缺口，不用猜测填充。
4. Renderer 能显示空结果、歧义候选、部分覆盖、缓存过期和低置信度，而不是只显示成功卡片。
