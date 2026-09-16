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

  it('validates registered player name and activates student pass on submit', async () => {
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
    const submitBtn = screen.getByRole('button', { name: /Confirm & Activate Pass/i });

    // Pre-filled with student name
    expect(nameInput).toHaveValue('Aarav Sharma');
    expect(submitBtn).not.toBeDisabled();

    // Clear name (too short) -> button disabled
    fireEvent.change(nameInput, { target: { value: ' ' } });
    expect(submitBtn).toBeDisabled();

    // Enter valid player name
    fireEvent.change(nameInput, { target: { value: 'Aarav Sharma' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pass Active!/i)).toBeInTheDocument();
      expect(screen.getAllByText('Aarav Sharma').length).toBeGreaterThan(0);
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student_1',
        studentName: 'Aarav Sharma',
        registeredName: 'Aarav Sharma',
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

    const nameInput = screen.getByLabelText(/Your Registered Name in App/i);
    fireEvent.change(nameInput, { target: { value: 'Rohan Patel' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Activate Pass/i }));

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
    expect(screen.getByText(/Rohan Patel/i)).toBeInTheDocument();
  });
});
