import { expect, test, type Page } from '@playwright/test';

const essay = [
  '우리 반 친구들과 함께 학교 텃밭에서 강낭콩을 기르고 있습니다. 처음에는 작은 씨앗에서 어떻게 커다란 잎이 나오는지 궁금했습니다.',
  '매일 아침 흙이 마르지 않았는지 살펴보고 필요한 만큼만 물을 주었습니다. 물을 너무 많이 주면 뿌리가 상할 수 있다는 사실도 배웠습니다.',
  '며칠 뒤에 초록색 새싹이 흙을 밀고 올라왔습니다. 친구들과 함께 새싹의 길이를 재고 관찰 공책에 날짜와 날씨를 자세하게 기록했습니다.',
  '어떤 화분은 햇빛이 잘 드는 창가에 두고 다른 화분은 조금 그늘진 곳에 두었습니다. 자라는 모습이 서로 달라서 햇빛의 중요성을 알 수 있었습니다.',
  '우리는 관찰한 내용을 사진과 글로 정리해서 학급 누리집에 올리기로 했습니다. 친구들이 언제든지 읽고 자신의 경험을 댓글로 나눌 수 있기 때문입니다.',
  '관찰 결과만 적기보다는 어려웠던 일과 해결한 방법도 함께 소개하면 좋겠습니다. 그래야 다음에 식물을 기르는 친구들에게 실제로 도움이 될 것입니다.',
  '물을 주는 일을 혼자 맡으면 잊어버릴 수 있으니 모둠 친구들이 돌아가면서 돌보는 방법을 제안합니다. 당번표를 만들어 교실 벽에 붙이면 누구나 쉽게 확인할 수 있습니다.',
  '나와 다른 생각을 가진 친구의 의견도 끝까지 듣고 싶습니다. 식물을 건강하게 기르는 방법을 함께 찾아가면 우리 반의 협력하는 마음도 자라날 것이라고 생각합니다.',
  '앞으로 꽃이 피고 열매가 맺히는 모습까지 꾸준히 관찰하겠습니다. 열매를 수확하는 날에는 모두가 노력한 과정을 돌아보며 가장 인상 깊었던 순간을 이야기하고 싶습니다.',
].join('\n\n');

async function login(page: Page, nickname: string) {
  await page.goto('/');
  await page.getByLabel('학급 코드', { exact: true }).fill('browser-test-only');
  await page.getByLabel('친구들이 불러 줄 별명').fill(nickname);
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(page.getByRole('dialog', { name: '새 이야기 쓰기' })).toBeVisible();
}
async function seeBoard(page: Page) {
  await page.getByRole('button', { name: '게시판 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: /탑텐반 학급누리집/ })).toBeVisible();
}
async function openStory(page: Page, title: string) {
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
}

test('classmates revise, publish, recommend, reply, and complete one comment mission', async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('학급 코드', { exact: true }).fill('wrong-code');
  await page.getByLabel('친구들이 불러 줄 별명').fill('초록새싹');
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(page.getByRole('alert')).toHaveText('학급 코드를 다시 확인해 주세요.');
  await page.getByLabel('학급 코드', { exact: true }).fill('browser-test-only');
  await page.getByLabel('친구들이 불러 줄 별명').fill('씨발');
  await page.getByRole('button', { name: '우리 반 들어가기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await login(page, '초록새싹');
  const title = '친구들과 함께 기르는 우리 반 강낭콩';
  const submit = page.getByRole('button', { name: '글 올리기', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel('제목', { exact: true }).fill(title);
  await page.getByLabel('나의 이야기', { exact: true }).fill(essay.replace(/\s/gu, '').slice(0, 499));
  await expect(submit).toBeDisabled();
  await page.getByLabel('나의 이야기', { exact: true }).fill(essay);
  await page.getByRole('radio', { name: /책 이야기/ }).check();
  await page.screenshot({ path: 'test-results/topten-composer.png', fullPage: false });
  await submit.click();
  const review = page.getByRole('dialog', { name: '스스로 고쳐쓰기' });
  await expect(review).toBeVisible();
  const publish = page.getByRole('button', { name: '확인하고 게시하기' });
  await expect(publish).toBeDisabled();
  const checks = review.getByRole('checkbox');
  await expect(checks).toHaveCount(4);
  for (let i = 0; i < 3; i++) await checks.nth(i).check();
  await expect(publish).toBeDisabled();
  await page.getByRole('button', { name: '돌아가서 고치기' }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('나의 이야기', { exact: true })).toHaveValue(essay);
  await submit.click();
  for (let i = 0; i < 4; i++) {
    await expect(checks.nth(i)).not.toBeChecked();
    await checks.nth(i).check();
  }
  await page.screenshot({ path: 'test-results/topten-review.png', fullPage: false });
  await publish.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();

  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  await friend.setViewportSize({ width: 1440, height: 1100 });
  friend.on('pageerror', (error) => errors.push(error.message));
  await login(friend, '노란별');
  await seeBoard(friend);
  await openStory(friend, title);
  const recommendation = friend.getByRole('button', { name: /추천하기/ });
  await recommendation.click();
  await expect(friend.getByRole('button', { name: /추천했어요/ })).toHaveAttribute('aria-pressed', 'true');
  await friend.getByRole('button', { name: /추천했어요/ }).click();
  await expect(recommendation).toHaveAttribute('aria-pressed', 'false');
  await recommendation.click();

  const commentInput = friend.getByLabel('노란별의 한마디');
  await commentInput.fill('ㅁㄴ로호'.repeat(8));
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByRole('alert')).toBeVisible();
  const firstComment = '나도 식물을 기르고 싶어요. 관찰한 내용을 나누어 주어서 고마워요. <script>alert(1)</script>';
  await commentInput.fill(firstComment);
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByText(firstComment, { exact: true })).toBeVisible();
  await expect(friend.getByText('다정한 댓글을 남겼어요. 미션 1 / 3개!')).toBeVisible();
  await commentInput.fill(firstComment);
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByRole('alert')).toBeVisible();

  await friend.getByRole('button', { name: '답글 쓰기', exact: true }).first().click();
  const reply = '사진을 함께 소개하면 친구들이 식물의 변화를 더 쉽게 이해할 수 있을 것 같아요.';
  await friend.getByLabel('노란별에게 답글 쓰기').fill(reply);
  await friend.getByRole('button', { name: '답글 남기기' }).click();
  await expect(friend.getByText(reply, { exact: true })).toBeVisible();
  await expect(friend.getByText('친구에게 답글을 남겼어요.')).toBeVisible();
  const second = '물을 주는 순서를 친구들과 함께 정하면 모두 즐겁게 참여할 수 있겠어요.';
  await commentInput.fill(second);
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByText('다정한 댓글을 남겼어요. 미션 2 / 3개!')).toBeVisible();
  await commentInput.fill('햇빛을 받은 시간도 함께 기록하면 식물의 성장 차이를 설명하기 좋겠어요.');
  await friend.getByRole('button', { name: '댓글 남기기' }).click();
  await expect(friend.getByText('축하해요! 댓글 3개 미션을 완료했어요. 🎉')).toBeVisible();
  await friend.getByRole('region', { name: '댓글', exact: true }).evaluate((section) => {
    const dialog = section.closest('dialog');
    if (dialog) dialog.scrollTop += section.getBoundingClientRect().top - dialog.getBoundingClientRect().top - 80;
  });
  await friend.screenshot({ path: 'test-results/topten-detail.png', fullPage: false });
  await friend.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(friend.getByRole('region', { name: '댓글 미션' }).getByText('미션 1개 완료!')).toBeVisible();
  await friend.evaluate(() => window.scrollTo(0, 0));
  await friend.screenshot({ path: 'test-results/topten-board.png', fullPage: true });
  await friend.reload();
  await seeBoard(friend);
  await expect(friend.getByRole('region', { name: '댓글 미션' }).getByText('미션 1개 완료!')).toBeVisible();

  await page.reload();
  await seeBoard(page);
  await page.getByRole('searchbox', { name: '이야기 검색' }).fill(title);
  await openStory(page, title);
  await expect(page.getByText(firstComment, { exact: true })).toBeVisible();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /추천하기 1/ })).toBeVisible();
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
  await seeBoard(page);
  await expect(page.getByRole('region', { name: '댓글 미션' })).toBeVisible();
  await page.screenshot({ path: 'test-results/topten-mobile.png', fullPage: true });
  await page.getByRole('searchbox').fill('존재하지않는특별한검색어');
  await expect(page.getByRole('heading', { name: '아직 찾는 이야기가 없어요' })).toBeVisible();
  await page.getByRole('button', { name: '모든 이야기 보기', exact: true }).click();
  await page.getByRole('button', { name: '내 이야기 쓰기', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '내 이야기 쓰기', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '우리의 약속', exact: true }).click();
  await expect(page.getByRole('heading', { name: '함께 지키면 더 따뜻해요.' })).toBeVisible();
  await page.getByRole('button', { name: '함께 약속할게요' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
