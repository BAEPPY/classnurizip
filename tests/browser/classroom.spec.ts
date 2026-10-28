import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, nickname: string) {
  await page.goto('/');
  await page.getByLabel('학급 코드', { exact: true }).fill('browser-test-only');
  await page.getByLabel('친구들이 불러 줄 별명').fill(nickname);
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(page.getByRole('heading', { name: /작은 이야기도/ })).toBeVisible();
}

test('classmates can enter, write, comment, search, reload, and leave', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('학급 코드', { exact: true }).fill('wrong-code');
  await page.getByLabel('친구들이 불러 줄 별명').fill('초록새싹');
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(page.getByRole('alert')).toHaveText('학급 코드를 다시 확인해 주세요.');
  await login(page, '초록새싹');
  await page.getByRole('button', { name: '내 이야기 쓰기', exact: true }).click();
  await page.getByRole('radio', { name: /책 이야기/ }).check();
  const title = `친구에게 추천하는 책 ${Date.now()}`;
  await page.getByLabel('제목', { exact: true }).fill(title);
  await page
    .getByLabel('나의 이야기', { exact: true })
    .fill('어린 왕자를 읽었어요.\n여러분에게도 추천해요!');
  await page.getByRole('button', { name: '이야기 올리기' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  await login(friend, '노란별');
  await friend
    .getByRole('button')
    .filter({ has: friend.getByRole('heading', { name: title }) })
    .click();
  await friend.getByLabel('노란별의 한마디').fill('나도 읽어 보고 싶어! <script>alert(1)</script>');
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByText('따뜻한 댓글을 남겼어요.')).toBeVisible();
  await expect(
    friend.getByText('나도 읽어 보고 싶어! <script>alert(1)</script>', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /작은 이야기도/ })).toBeVisible();
  await page.getByRole('searchbox', { name: '이야기 검색' }).fill(title);
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: title }) })
    .click();
  await expect(
    page.getByText('나도 읽어 보고 싶어! <script>alert(1)</script>', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '우리 반에서 나가기' }).click();
  await expect(page.getByRole('button', { name: '우리 반 들어가기' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '우리 반 들어가기' })).toBeVisible();
  expect(errors).toEqual([]);
  await friendContext.close();
});

test('mobile layout, empty search, rules dialog, and keyboard focus work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, '작은나무');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('searchbox').fill('존재하지않는특별한검색어');
  await expect(page.getByRole('heading', { name: '아직 찾는 이야기가 없어요' })).toBeVisible();
  await page.getByRole('button', { name: '모든 이야기 보기', exact: true }).click();
  await page.getByRole('button', { name: '내 이야기 쓰기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(
      true,
    );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '내 이야기 쓰기', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '우리의 약속', exact: true }).click();
  await expect(page.getByRole('heading', { name: '함께 지키면 더 따뜻해요.' })).toBeVisible();
  await page.getByRole('button', { name: '함께 약속할게요' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
