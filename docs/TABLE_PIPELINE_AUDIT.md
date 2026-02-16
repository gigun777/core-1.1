# Аудит ланцюжка таблиць: від шаблону до рендеру

## 1) Створення журналу та прив’язка шаблону

1. Кнопка `+` у навігації викликає `createJournalWithTemplate(...)` у UI.
2. `createJournalWithTemplate(...)` бере доступні шаблони з `sdo.journalTemplates.listTemplateEntities()`.
3. Після вибору шаблону створюється вузол журналу з полями `spaceId`, `parentId`, `templateId`, `title`, `childCount`.
4. Новий журнал записується через `sdo.commit(...)` у `next.journals` та одразу стає `activeJournalId`.

Ключова вимога: журнал має отримати `templateId` саме на кроці створення.

## 2) Де беруться шаблони

1. `createSEDO(...)` створює контейнер шаблонів `createJournalTemplatesContainer(storage)`.
2. На `start()` викликається `journalTemplates.ensureInitialized()`.
3. Якщо індекс шаблонів порожній, контейнер створює дефолтний шаблон `test` з 5 колонками.
4. Публічний API інстанса: `sdo.journalTemplates.{listTemplates, listTemplateEntities, getTemplate, addTemplate, deleteTemplate}`.

## 3) Як renderer розв’язує шаблон у схему таблиці

1. `table_renderer.resolveSchema(runtime)` читає `activeJournalId` і знаходить активний журнал.
2. `templateId` журналу використовується для `journalTemplates.getTemplate(templateId)`.
3. Шаблон конвертується у спрощену схему `schemaFromTemplate(...)` (`fields` з `key/label`, тип поки що `text`).
4. Якщо у журналу немає `templateId`, є auto-heal: призначається дефолтний шаблон (перевага `test`) і виконується best-effort `commit`.

## 4) Ланцюжок рендерингу таблиці

1. `table_renderer` завантажує settings (`loadSettings`) і dataset (`loadDataset`).
2. Якщо підключений `api.tableStore`, dataset читається через `tableStore.getDataset(journalId)`.
3. Якщо `tableStore` не підключений, renderer падає у fallback-режим: один спільний ключ storage (`@sdo/module-table-renderer:dataset`) для всіх журналів.
4. Renderer створює `createTableEngine({ schema, settings })`, передає dataset, викликає `engine.compute()`.
5. Комірки форматуються через `formatCell(...)` з `table_formatter`.
6. Після inline-edit формується patch з `engine.applyEdit(...)`, далі зберігається dataset через `saveDataset(...)`.

## 5) Модулі, що мають бути в бойовому ланцюжку

Мінімально потрібні для стабільної роботи нового табличного движка:

1. `@sdo/module-table-renderer` — UI панель таблиці, редагування, фільтр, вибір, add-row.
2. `@sdo/module-table-store` — ізольовані dataset-и по `journalId`, CRUD/імпорт/експорт/delta/backup.

Опціонально (покращення UX/інструментарій):

3. `@sdo/module-table-formatter` — реєстрація settings/preview-команди форматування.
4. `@sdo/module-table-engine` — окремий модуль-обгортка engine (у поточній реалізації renderer використовує `createTableEngine` напряму, тобто цей модуль не обов’язковий для базового рендеру).

## 6) Що виглядає «загубленим» або недопідключеним

1. **`tableStore` може бути не підключений**.
   - Симптом: таблиці різних журналів «перетирають» одна одну, бо renderer використовує один fallback-ключ storage.
   - Дія: переконатися, що в `createSEDO({ modules: [...] })` реально переданий `createTableStoreModule()`.

2. **`table_formatter` підключений не як модуль, а лише як util-імпорт у renderer**.
   - Це не ламає рендер, але втрачаються registry-інтеграції formatter-модуля (settings tab, preview command, toolbar button).
   - Дія: за потреби додати `createTableFormatterModule()` в modules bootstrap.

3. **`createJournalStore` фактично не у використанні в runtime-ланцюжку**.
   - Є як простий helper над масивом templates, але основний потік працює через `journal_templates_container`.
   - Дія: або прибрати як legacy, або явно інтегрувати, щоб не вводив в оману.

4. **Модуль `table_engine` не є обов’язковим у поточній зв’язці**.
   - Renderer конструює engine напряму, тому окремий модуль engine може здаватися «підключеним», але не впливати на panel flow.
   - Дія: визначити єдину архітектуру: або renderer завжди спирається на `ctx.api` engine-модуля, або залишити direct-import як канон.

## 7) Перевірочний чеклист інтеграції

1. У bootstrap модулів є обидва модулі: `createTableStoreModule()` і `createTableRendererModule()`.
2. При створенні журналу в persisted `journals_nodes_v2` у кожного журналу є `templateId`.
3. Для різних `journalId` у storage з’являються різні ключі `tableStore:dataset:<journalId>`.
4. Нема fallback-запису в `@sdo/module-table-renderer:dataset` (або він не використовується в production).
5. При перемиканні журналів відображаються різні набори рядків (ізоляція даних).
