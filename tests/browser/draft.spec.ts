import { expect, test, type Dialog, type Page } from '@playwright/test';

const title = '자동으로 저장하는 우리 반의 이야기';
const content = '오늘은 친구들과 함께 학교 텃밭을 살펴보았습니다. 작은 새싹을 관찰하며 물을 주는 순서를 함께 정하고 서로의 생각을 나누었습니다.';
const publishableContent = content.repeat(6).replace(/\s/gu, '').slice(0, 200);

const composer = (page: Page) => page.getByRole('dialog', { name: '새 이야기 쓰기' });
const titleInput = (page: Page) => page.getByLabel('제목', { exact: true });
const contentInput = (page: Page) => page.getByLabel('나의 이야기', { exact: true });

async function login(page: Page, nickname: string) {
  await page.goto('/');
  await page.getByLabel('친구들이 불러 줄 별명').fill(nickname);
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(composer(page)).toBeVisible();
}

async function openComposer(page: Page) {
  await page.getByRole('button', { name: '내 이야기 쓰기', exact: true }).click();
  await expect(composer(page)).toBeVisible();
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '우리 반에서 나가기' }).click();
  await expect(page.getByLabel('친구들이 불러 줄 별명')).toBeVisible();
}

async function leave(page: Page, trigger: () => Promise<unknown>, accept: boolean) {
  const dialogPromise = page.waitForEvent('dialog');
  const action = trigger();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toMatch(/나가겠습니까/);
  expect(dialog.message()).toContain('임시저장');
  await (accept ? dialog.accept() : dialog.dismiss());
  await action;
}

async function saveDraft(page: Page) {
  await titleInput(page).fill(title);
  await contentInput(page).fill(content);
  await page.getByRole('radio', { name: /책 이야기/ }).check();
  await expect(page.getByText('자동 임시저장했어요.', { exact: false })).toBeVisible();
}

async function expectDraft(page: Page) {
  await expect(titleInput(page)).toHaveValue(title);
  await expect(contentInput(page)).toHaveValue(content);
  await expect(page.getByRole('radio', { name: /책 이야기/ })).toBeChecked();
}

test('all composer exits confirm and preserve the automatically saved draft', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await login(page, '임시저장친구');

  let emptyEditorDialogs = 0;
  const rejectUnexpected = async (dialog: Dialog) => {
    emptyEditorDialogs++;
    await dialog.dismiss();
  };
  page.on('dialog', rejectUnexpected);
  await page.getByRole('button', { name: '게시판 보기', exact: true }).click();
  await expect(composer(page)).toHaveCount(0);
  page.off('dialog', rejectUnexpected);
  expect(emptyEditorDialogs).toBe(0);

  await openComposer(page);
  await saveDraft(page);
  const exits = [
    () => page.getByRole('button', { name: '게시판 보기', exact: true }).click(),
    () => page.getByRole('button', { name: '닫기', exact: true }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(1, 1),
  ];
  for (const exit of exits) {
    await leave(page, exit, false);
    await expect(composer(page)).toBeVisible();
    await expectDraft(page);
    await leave(page, exit, true);
    await expect(composer(page)).toHaveCount(0);
    await openComposer(page);
    await expectDraft(page);
  }
  await page.screenshot({ path: 'test-results/autosaved-draft.png', fullPage: false });
});

test('refresh restores drafts and separate nicknames keep separate drafts', async ({ page }) => {
  await login(page, '이어쓰기친구');
  await saveDraft(page);
  const unloading = page.waitForEvent('dialog');
  const reload = page.reload();
  const warning = await unloading;
  expect(warning.type()).toBe('beforeunload');
  await warning.accept();
  await reload;
  await expectDraft(page);

  await leave(page, () => page.getByRole('button', { name: '게시판 보기', exact: true }).click(), true);
  await logout(page);
  await login(page, '다른별친구');
  await expect(titleInput(page)).toHaveValue('');
  await expect(contentInput(page)).toHaveValue('');
  await titleInput(page).fill('다른 친구가 쓰는 새로운 제목');
  await leave(page, () => page.keyboard.press('Escape'), true);
  await logout(page);
  await login(page, '이어쓰기친구');
  await expectDraft(page);
});

test('failed publication keeps the draft and successful publication clears it', async ({ page }) => {
  await login(page, '게시확인친구');
  await titleInput(page).fill(title);
  await contentInput(page).fill(publishableContent);
  await page.getByRole('button', { name: '글 올리기', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();

  await page.route('**/api/posts', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 503, json: { error: '연결이 잠깐 끊겼어요. 다시 시도해 주세요.' } });
    } else await route.continue();
  });
  await page.getByRole('button', { name: '확인하고 게시하기' }).click();
  await expect(page.getByRole('alert')).toContainText('연결이 잠깐 끊겼어요');
  await leave(page, () => page.getByRole('button', { name: '닫기', exact: true }).click(), true);
  await openComposer(page);
  await expect(titleInput(page)).toHaveValue(title);
  await expect(contentInput(page)).toHaveValue(publishableContent);

  await page.unroute('**/api/posts');
  await page.getByRole('button', { name: '글 올리기', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
  }
  await page.getByRole('button', { name: '확인하고 게시하기' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await openComposer(page);
  await expect(titleInput(page)).toHaveValue('');
  await expect(contentInput(page)).toHaveValue('');
});

test('unavailable browser storage shows a warning and keeps the open-session draft', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'QuotaExceededError'); };
  });
  await login(page, '저장확인친구');
  await titleInput(page).fill(title);
  await contentInput(page).fill(content);
  await expect(page.getByRole('alert')).toContainText('자동 임시저장을 하지 못했어요.');
  const dialogPromise = page.waitForEvent('dialog');
  const close = page.getByRole('button', { name: '게시판 보기', exact: true }).click();
  const warning = await dialogPromise;
  expect(warning.type()).toBe('confirm');
  expect(warning.message()).toContain('날아갑니다');
  await warning.accept();
  await close;
  await leave(page, () => page.getByRole('button', { name: '우리 반에서 나가기' }).click(), false);
  await expect(page.getByRole('button', { name: '우리 반에서 나가기' })).toBeVisible();
  await openComposer(page);
  await expect(titleInput(page)).toHaveValue(title);
  await expect(contentInput(page)).toHaveValue(content);
  await expect(page.getByRole('alert')).toContainText('자동 임시저장을 하지 못했어요.');

  await contentInput(page).fill(publishableContent);
  await page.route('**/api/posts', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 401, json: { error: '입장 시간이 만료되었어요.' } });
    } else await route.continue();
  });
  await page.getByRole('button', { name: '글 올리기', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: '확인하고 게시하기' }).click();
  await expect(page.getByRole('dialog', { name: '스스로 고쳐쓰기' })).toBeVisible();
  await expect(page.getByText('입장 시간이 만료되었어요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '돌아가서 고치기' }).click();
  await expect(titleInput(page)).toHaveValue(title);
  await expect(contentInput(page)).toHaveValue(publishableContent);
});

test('an older tab cannot overwrite or delete a newer draft in another tab', async ({ page, context }) => {
  await login(page, '여러창친구');
  const emptyTab = await context.newPage();
  await emptyTab.goto('/');
  await expect(titleInput(emptyTab)).toHaveValue('');
  await titleInput(page).fill(title);
  await expect(titleInput(emptyTab)).toHaveValue(title);
  await emptyTab.close();
  await contentInput(page).fill(publishableContent);

  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await expect(titleInput(otherTab)).toHaveValue(title);
  const newerTitle = '다른 창에서 이어 쓰고 있는 새로운 이야기';
  const newerContent = '두 번째 창에서 친구들과 나눌 새로운 생각을 적고 있습니다. 먼저 열었던 창에서 글을 올려도 이 내용은 남아 있어야 합니다.';
  await titleInput(otherTab).fill(newerTitle);
  await contentInput(otherTab).fill(newerContent);
  await expect(otherTab.getByText('자동 임시저장했어요.', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('자동 임시저장을 하지 못했어요.');
  await expect(titleInput(page)).toHaveValue(title);
  await expect(contentInput(page)).toHaveValue(publishableContent);

  await contentInput(page).fill(publishableContent + '먼저 쓰던 글에 생각을 더했습니다.');
  await expect(page.getByRole('alert')).toContainText('자동 임시저장을 하지 못했어요.');
  await page.getByRole('button', { name: '글 올리기', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: '확인하고 게시하기' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await openComposer(page);
  await expect(titleInput(page)).toHaveValue(newerTitle);
  await expect(contentInput(page)).toHaveValue(newerContent);

  const restoredTab = await context.newPage();
  await restoredTab.goto('/');
  await expect(titleInput(restoredTab)).toHaveValue(newerTitle);
  await expect(contentInput(restoredTab)).toHaveValue(newerContent);
});
