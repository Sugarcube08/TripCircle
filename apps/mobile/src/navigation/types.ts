export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyOtp: { email: string; purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET' };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  ActivityTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  TripDashboard: { tripId: string };
  CreateTrip: undefined;
  AddExpense: { tripId: string };
  EditExpense: { tripId: string; expenseId: string };
  ExpenseDetail: { tripId: string; expenseId: string };
  AddPayment: { tripId: string; defaultReceiverMemberId?: string };
  PaymentDetail: { tripId: string; paymentId: string };
  SettlementDashboard: { tripId: string };
  TripMembers: { tripId: string };
  MemberProfile: { tripId: string; memberId: string };
  TripSettings: { tripId: string };
  ExportReport: { tripId: string };
  Invitations: undefined;
  ReceiptViewer: { uri: string };
};
