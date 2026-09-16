import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentMonthlyFeeModal } from '../components/StudentMonthlyFeeModal';
import { StudentMonthlyFeeBanner } from '../components/StudentMonthlyFeeBanner';
import { recordStudentFeePayment, updateStudentFeePaymentStatus } from '../api/studentFeeStore';

function createMockFile() {
  return new File(['mock receipt content'], 'receipt.png', { type: 'image/png' });
}

describe('StudentMonthlyFeeModal & Banner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders FamPay QR image and UPI ID in modal', () => {
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

    expect(screen.getByAltText('FamPay QR Code')).toBeInTheDocument();
    expect(screen.getByText('7358875632@fam')).toBeInTheDocument();
    expect(screen.getByText(/Pay via UPI App/i)).toBeInTheDocument();
  });

  it('validates registered player name + required screenshot and submits for verification', async () => {
    const handleSuccess = vi.fn();

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

  it('renders due banner when unpaid, pending banner when submitted, and active banner when verified', async () => {
    const { rerender } = render(
      <StudentMonthlyFeeBanner
        studentId="student_2"
        studentName="Rohan Patel"
        studentEmail="rohan@gmail.com"
        academyId="acad_1"
        academyName="Apex Academy"
      />,
    );

    // Initial state: Unpaid
    expect(screen.getByText(/Monthly Pass · ₹200/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay ₹200/i })).toBeInTheDocument();

    // Submit payment
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹200/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByText(/Receipt Screenshot Attached/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit for Verification/i }));

    await waitFor(() => {
      expect(screen.getByText(/Payment Submitted!/i)).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // Banner now shows Pending Verification
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

    // Admin verifies payment
    const payment = recordStudentFeePayment(
      {
        studentId: 'student_2',
        studentName: 'Rohan Patel',
        studentEmail: 'rohan@gmail.com',
        academyId: 'acad_1',
        academyName: 'Apex Academy',
        monthKey: '2026-09',
        monthLabel: 'September 2026',
        amount: 200,
      },
      'verified',
    );
    updateStudentFeePaymentStatus(payment.id, 'verified');

    // Banner now shows Active
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

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createMockFile()] } });

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
