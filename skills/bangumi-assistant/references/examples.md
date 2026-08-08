# 典型交互与 Tool 调用示例

## 示例 1: 搜索动画并查看详情

**用户**：帮我搜索一下“少女终末旅行”
**Agent**：调用 `bangumi.search_subjects({ query: "少女终末旅行" })`
**工具返回**：

```json
{
  "status": "exact",
  "subject": {
    "id": 226998,
    "name": "少女終末旅行",
    "nameCn": "少女终末旅行",
    "score": 8.6
  }
}
```

**Agent 对应输出**：找到《少女终末旅行》（Bangumi ID: 226998），评分 8.6。

## 示例 2: 查询主要角色与声优

**用户**：它的主要声优是谁？
**Agent**：调用 `bangumi.get_subject_cast({ subjectId: 226998 })`
**工具返回**：

```json
[
  {
    "character": { "id": 56427, "name": "チト" },
    "actors": [{ "id": 13917, "name": "水瀬いのり" }]
  },
  {
    "character": { "id": 56428, "name": "ユーリ" },
    "actors": [{ "id": 20493, "name": "久保ユリカ" }]
  }
]
```

## 示例 3: 查看新番每日放送

**用户**：今天有什么动画播出？
**Agent**：调用 `bangumi.get_calendar({})`
