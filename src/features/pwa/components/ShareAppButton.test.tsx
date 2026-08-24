import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useShare } from '../hooks/useShare';
import { ShareAppButton } from './ShareAppButton';

vi.mock('../hooks/useShare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useShare')>();
  return { ...actual, useShare: vi.fn() };
});

const mockUseShare = vi.mocked(useShare);

afterEach(() => {
  vi.clearAllMocks();
});

describe('<ShareAppButton />', () => {
  it('uses the native share sheet when Web Share API is available', async () => {
    const share = vi.fn().mockResolvedValue(true);
    const copyUrl = vi.fn().mockResolvedValue(true);
    mockUseShare.mockReturnValue({ supported: true, share, copyUrl });
    const user = userEvent.setup();

    render(<ShareAppButton />);
    await user.click(screen.getByRole('button', { name: 'Share App' }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(copyUrl).not.toHaveBeenCalled();
  });

  it('copies the production URL when the Web Share API is unavailable', async () => {
    const share = vi.fn().mockResolvedValue(false);
    const copyUrl = vi.fn().mockResolvedValue(true);
    mockUseShare.mockReturnValue({ supported: false, share, copyUrl });
    const user = userEvent.setup();

    render(<ShareAppButton />);
    await user.click(screen.getByRole('button', { name: 'Share App' }));

    await waitFor(() => expect(copyUrl).toHaveBeenCalled());
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });

  it('falls back to copying when the native share sheet is cancelled', async () => {
    const share = vi.fn().mockResolvedValue(false);
    const copyUrl = vi.fn().mockResolvedValue(true);
    mockUseShare.mockReturnValue({ supported: true, share, copyUrl });
    const user = userEvent.setup();

    render(<ShareAppButton />);
    await user.click(screen.getByRole('button', { name: 'Share App' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    await waitFor(() => expect(copyUrl).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
  });
});
