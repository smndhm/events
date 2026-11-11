// A plain browser's name: some sites turn away anything else
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

// Fetches a page as text. Its redirection is not followed: a site that sends a page past its last one elsewhere says
// so with it, and the caller decides. A failure throws, naming the address.
export const fetchPage = async (url: string): Promise<{ status: number; html: string }> => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-FR,fr;q=0.9' },
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status >= 400) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return { status: response.status, html: await response.text() };
};
