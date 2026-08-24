import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePwaInstall } from '../hooks/usePwaInstall';
import { InstallAppButton } from './InstallAppButton';

vi.mock('../hooks/usePwaInstall', () => ({
  usePwaInstall: vi.fn(),
}));

const mockUsePwaInstall = vi.mocked(usePwaInstall);

function mockInstallState(overrides: Partial<ReturnType<typeof usePwaInstall>>) {
  const install = vi.fn().mockResolvedValue(true);
  mockUsePwaInstall.mockReturnValue({
    canInstall: false,
    isInstalled: false,
    isIOS: false,
    install,
    ...overrides,
  });
  return install;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('<InstallAppButton />', () => {
  it('renders nothing when installation is unavailable on Android/desktop', () => {
    mockInstallState({ canInstall: false, isIOS: false });

    const { container } = render(<InstallAppButton />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Install App button when beforeinstallprompt is available', async () => {
    const install = mockInstallState({ canInstall: true, isIOS: false });
    const user = userEvent.setup({ delay: null });

    render(<InstallAppButton />);
    const button = screen.getByRole('button', { name: 'Install App' });
    await user.click(button);

    expect(install).toHaveBeenCalledOnce();
  });

  it('opens iOS instructions instead of the native prompt on iOS', async () => {
    mockInstallState({ canInstall: false, isIOS: true });
    const user = userEvent.setup({ delay: null });

    render(<InstallAppButton />);
    await user.click(screen.getByRole('button', { name: 'Install App' }));

    expect(
      screen.getByRole('heading', { name: 'Install Cricket Academy Manager' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tap the Share button in Safari.')).toBeInTheDocument();
    expect(screen.getByText('Select Add to Home Screen.')).toBeInTheDocument();
    expect(screen.getByText('Tap Add.')).toBeInTheDocument();
  });

  it('shows the installed state instead of asking the user to install again', () => {
    mockInstallState({ isInstalled: true });

    render(<InstallAppButton />);

    expect(screen.getByRole('button', { name: 'App installed' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Install App' })).not.toBeInTheDocument();
  });
});
