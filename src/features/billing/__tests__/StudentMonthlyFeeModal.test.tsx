import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentMonthlyFeeModal } from '../components/StudentMonthlyFeeModal';
import { StudentMonthlyFeeBanner } from '../components/StudentMonthlyFeeBanner';

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

  it('validates 12-digit UTR and activates student pass on submit', async () => {
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

    const utrInput = screen.getByPlaceholderText(/425891029384/i);
    const submitBtn = screen.getByRole('button', { name: /Activate Pass/i });

    // Invalid UTR (too short) -> button disabled
    fireEvent.change(utrInput, { target: { value: '12345' } });
    expect(submitBtn).toBeDisabled();

    // Valid 12-digit UTR
    fireEvent.change(utrInput, { target: { value: '425891029384' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pass Active!/i)).toBeInTheDocument();
      expect(screen.getByText('425891029384')).toBeInTheDocument();
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student_1',
        utr: '425891029384',
        amount: 200,
      }),
    );
  });

  it('renders due banner when unpaid and active banner when paid', async () => {
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

    // Trigger payment
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹200/i }));

    const utrInput = screen.getByPlaceholderText(/425891029384/i);
    fireEvent.change(utrInput, { target: { value: '987654321098' } });
    fireEvent.click(screen.getByRole('button', { name: /Activate Pass/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pass Active!/i)).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // Now banner shows Active
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
    expect(screen.getByText('987654321098')).toBeInTheDocument();
  });
});
