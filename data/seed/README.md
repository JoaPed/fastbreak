# Dados manuais

Ficheiros nesta pasta são carregados para o Supabase pela tarefa **Carregar dados manuais** sempre que mudam.

- `runs/<id>.json`: `{"run": {"id", "name", "start_date", "end_date", "prizes", "active"}, "days": [{"date", "objectives": [{"stat", "target"}]}]}`
- `odds/<AAAA-MM-DD>.json`: `{"date", "source", "players": {"<personId NBA>": {"pts": {"line": 24.5, "over": -115, "under": -105}}}}`
- `players.json`: `[{"id": "<personId NBA>", "name", "team", "avg": {"pts", "reb", "ast", "fg3", "stl", "blk"}}]`

Estatísticas: `pts`, `reb`, `ast`, `fg3` (triplos), `stl` (roubos), `blk` (desarmes).
