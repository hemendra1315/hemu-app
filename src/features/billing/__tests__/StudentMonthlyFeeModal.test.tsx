import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError, ApiErrorCode } from '@/lib/api';

const mockUseStudentFeePayment = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('../api/studentFeeStore', async () => {
  const actual =
    await vi.importActual<typeof import('../api/studentFeeStore')>('../api/studentFeeStore');
  return {
    ...actual,
    useStudentFeePayment: (studentId?: string) => mockUseStudentFeePayment(studentId),
    useSubmitStudentFeeClaim: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  };
});

import { StudentMonthlyFeeModal } from '../components/StudentMonthlyFeeModal';
import { StudentMonthlyFeeBanner } from '../components/StudentMonthlyFeeBanner';
import {
  getCurrentMonthKey,
  getCurrentMonthLabel,
  type StudentFeePayment,
} from '../api/studentFeeStore';

function createMockFile() {
  return new File(['mock receipt content'], 'receipt.png', { type: 'image/png' });
}

function baseHookState(overrides: Partial<ReturnType<typeof defaultHookState>> = {}) {
  return { ...defaultHookState(), ...overrides };
}

function defaultHookState() {
  return {
    payment: undefined as StudentFeePayment | undefined,
    isPaidThisMonth: false,
    isPendingThisMonth: false,
    isRejectedThisMonth: false,
    status: undefined as StudentFeePayment['status'] | undefined,
    currentMonthKey: getCurrentMonthKey(),
    currentMonthLabel: getCurrentMonthLabel(),
    isLoading: false,
    isError: false,
    error: null,
    refreshPayment: vi.fn(),
  };
}

function makePayment(overrides: Partial<StudentFeePayment> = {}): StudentFeePayment {
  return {
    id: 'pay_1',
    studentId: 'student_1',
    studentName: 'Aarav Sharma',
    registeredName: 'Aarav Sharma',
    studentEmail: 'aarav@gmail.com',
    academyId: 'acad_1',
    academyName: 'Apex Cricket Academy',
    monthKey: getCurrentMonthKey(),
    monthLabel: getCurrentMonthLabel(),
    amount: 200,
    status: 'pending',
    paidAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('StudentMonthlyFeeModal & Banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStudentFeePayment.mockReturnValue(baseHookState());
  });

  it('renders FamPay QR image and UPI ID in modal', async () => {
    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_1"
        studentName="Aarav Sharma"
        studentEmail="aarav@gmail.com"
        academyId="acad_1"
        academyName="Apex Cricket Academy"
      />,
    );

    expect(await screen.findByAltText('FamPay QR Code', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('7358875632@fam')).toBeInTheDocument();
    const payLink = screen.getByRole('link', { name: /Pay via UPI App/i });
    expect(payLink).toBeInTheDocument();
    expect(payLink).toHaveAttribute('href', expect.stringContaining('pa=7358875632@fam'));
    expect(payLink.getAttribute('href')).not.toContain('%40');
  });

  it('validates registered player name + required screenshot and submits for verification', async () => {
    const handleSuccess = vi.fn();
    const submittedPayment = makePayment({ studentName: 'Aarav Sharma', status: 'pending' });
    mockMutateAsync.mockResolvedValueOnce(submittedPayment);

    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_1"
        studentName="Aarav Sharma"
        studentEmail="aarav@gmail.com"
        academyId="acad_1"
        academyName="Apex Cricket Academy"
        onPaymentSuccess={handleSuccess}
      />,
    );

    const nameInput = screen.getByLabelText(/Your Registered Name in App/i);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Submit for Verification/i });

    // Without screenshot -> button disabled
    expect(submitBtn).toBeDisabled();

    // Attach receipt screenshot
    const file = createMockFile();
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Receipt Screenshot Attached/i)).toBeInTheDocument();
    });

    expect(submitBtn).not.toBeDisabled();

    // Clear name (too short) -> button disabled
    fireEvent.change(nameInput, { target: { value: ' ' } });
    expect(submitBtn).toBeDisabled();

    // Enter valid player name
    fireEvent.change(nameInput, { target: { value: 'Aarav Sharma' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment Submitted!/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending Verification ⏳/i)).toBeInTheDocument();
      expect(screen.getAllByText('Aarav Sharma').length).toBeGreaterThan(0);
    });

    // The real File — never a base64 data URL — is what gets sent upstream.
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Aarav Sharma',
        registeredName: 'Aarav Sharma',
        receiptFile: file,
      }),
    );

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student_1',
        studentName: 'Aarav Sharma',
        registeredName: 'Aarav Sharma',
        amount: 200,
        status: 'pending',
      }),
    );
  });

  it('shows a friendly error and does not close the form when submission fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError(
        ApiErrorCode.CONFLICT,
        'E_ALREADY_SUBMITTED: You have already submitted a payment for this period.',
      ),
    );

    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_1"
        studentName="Aarav Sharma"
        studentEmail="aarav@gmail.com"
        academyId="acad_1"
        academyName="Apex Cricket Academy"
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [createMockFile()] },
    });
    await waitFor(() => screen.getByText(/Receipt Screenshot Attached/i));

    fireEvent.click(screen.getByRole('button', { name: /Submit for Verification/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already submitted/i);
    });

    // The form is still showing — no fabricated success state.
    expect(screen.queryByText(/Payment Submitted!/i)).not.toBeInTheDocument();
  });

  it('shows a generic error message for an unexpected upload/network failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_1"
        studentName="Aarav Sharma"
        studentEmail="aarav@gmail.com"
        academyId="acad_1"
        academyName="Apex Cricket Academy"
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [createMockFile()] },
    });
    await waitFor(() => screen.getByText(/Receipt Screenshot Attached/i));
    fireEvent.click(screen.getByRole('button', { name: /Submit for Verification/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Payment Submitted!/i)).not.toBeInTheDocument();
  });

  it('rejects a file over 5MB before ever attempting to submit', () => {
    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_1"
        studentName="Aarav Sharma"
        studentEmail="aarav@gmail.com"
        academyId="acad_1"
        academyName="Apex Cricket Academy"
      />,
    );

    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [oversized] },
    });

    expect(screen.queryByText(/Receipt Screenshot Attached/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for Verification/i })).toBeDisabled();
  });

  it('renders due banner when unpaid, pending banner when submitted, and active banner when verified', () => {
    mockUseStudentFeePayment.mockReturnValue(baseHookState());
    const { rerender } = render(
      <StudentMonthlyFeeBanner
        studentId="student_2"
        studentName="Rohan Patel"
        studentEmail="rohan@gmail.com"
        academyId="acad_1"
        academyName="Apex Academy"
      />,
    );

    expect(screen.getByText(/Monthly Pass · ₹200/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay ₹200/i })).toBeInTheDocument();

    const pendingPayment = makePayment({ studentId: 'student_2', status: 'pending' });
    mockUseStudentFeePayment.mockReturnValue(
      baseHookState({ payment: pendingPayment, isPendingThisMonth: true, status: 'pending' }),
    );
    rerender(
      <StudentMonthlyFeeBanner
        studentId="student_2"
        studentName="Rohan Patel"
        studentEmail="rohan@gmail.com"
        academyId="acad_1"
        academyName="Apex Academy"
      />,
    );
    expect(screen.getByText(/Pass Pending Verification/i)).toBeInTheDocument();

    const verifiedPayment = makePayment({ studentId: 'student_2', status: 'verified' });
    mockUseStudentFeePayment.mockReturnValue(
      baseHookState({ payment: verifiedPayment, isPaidThisMonth: true, status: 'verified' }),
    );
    rerender(
      <StudentMonthlyFeeBanner
        studentId="student_2"
        studentName="Rohan Patel"
        studentEmail="rohan@gmail.com"
        academyId="acad_1"
        academyName="Apex Academy"
      />,
    );
    expect(screen.getByText(/Pass Active/i)).toBeInTheDocument();
  });

  it('renders 1-tap WhatsApp share button on active receipt with pre-filled message', async () => {
    const submittedPayment = makePayment({
      studentId: 'student_whatsapp',
      studentName: 'Virat Kohli',
      academyName: 'Royal Cricket Academy',
      status: 'pending',
    });
    mockMutateAsync.mockResolvedValueOnce(submittedPayment);

    render(
      <StudentMonthlyFeeModal
        open={true}
        onClose={vi.fn()}
        studentId="student_whatsapp"
        studentName="Virat Kohli"
        studentEmail="virat@gmail.com"
        academyId="acad_1"
        academyName="Royal Cricket Academy"
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [createMockFile()] },
    });

    await waitFor(() => {
      expect(screen.getByText(/Receipt Screenshot Attached/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Submit for Verification/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Share Receipt on WhatsApp/i)).toBeInTheDocument();
    });

    const whatsappLink = screen.getByRole('link', { name: /Share Receipt on WhatsApp/i });
    expect(whatsappLink).toHaveAttribute(
      'href',
      expect.stringContaining('api.whatsapp.com/send?text='),
    );
    expect(whatsappLink.getAttribute('href')).toContain('Virat%20Kohli');
    expect(whatsappLink.getAttribute('href')).toContain('Royal%20Cricket%20Academy');
  });
});
