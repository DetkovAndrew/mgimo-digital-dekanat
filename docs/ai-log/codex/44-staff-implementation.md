Готово: `/staff` теперь показывает заявки факультета, фильтры, карточку с историей и обработку статусов. Изменение статуса, событие STAFF и уведомление студенту сохраняются одной транзакцией с блокировкой и проверкой ожидаемого статуса.

Файлы:

- `src/app/staff/**` — страницы, layout, форма и Server Action.
- [staff.ts](/home/acid/projects/MGIMO/src/server/dal/staff.ts) — DAL с ограничением по факультету.
- `src/lib/staff/requests.ts` и `.test.ts` — переходы и валидация.
- [staff.test.ts](/home/acid/projects/MGIMO/tests/integration/staff.test.ts) — 7 интеграционных тестов.
- [staff.md](/home/acid/projects/MGIMO/docs/plans/staff.md) — описание решений.

Существующий ответ студента возвращает заявку в «Новые» — это сохранено без изменения общего DAL.

Проверки: TypeScript и общий ESLint прошли, `npm test` — **94/94**. Интеграционные тесты и браузер на 360 px не запускал — нужны проверки Claude. Коммит не создавал.