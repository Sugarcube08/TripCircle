import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { LoginScreen } from '../features/auth/LoginScreen';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { VerifyOtpScreen } from '../features/auth/VerifyOtpScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../features/auth/ResetPasswordScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { TripDashboardScreen } from '../features/trips/TripDashboardScreen';
import { CreateTripScreen } from '../features/trips/CreateTripScreen';
import { TripMembersScreen } from '../features/trips/TripMembersScreen';
import { MemberProfileScreen } from '../features/trips/MemberProfileScreen';
import { TripSettingsScreen } from '../features/trips/TripSettingsScreen';
import { InvitationsScreen } from '../features/trips/InvitationsScreen';
import { AddExpenseScreen } from '../features/expenses/AddExpenseScreen';
import { EditExpenseScreen } from '../features/expenses/EditExpenseScreen';
import { ExpenseDetailScreen } from '../features/expenses/ExpenseDetailScreen';
import { AddPaymentScreen } from '../features/payments/AddPaymentScreen';
import { PaymentDetailScreen } from '../features/payments/PaymentDetailScreen';
import { SettlementDashboardScreen } from '../features/settlement/SettlementDashboardScreen';
import { ExportReportScreen } from '../features/reports/ExportReportScreen';

const Stack = createNativeStackNavigator();

interface RootNavigatorProps {
  user: any;
  setUser: (u: any) => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({ user, setUser }) => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Auth Flow
          <Stack.Group>
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={setUser} />}
            </Stack.Screen>
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="VerifyOtp">
              {(props) => <VerifyOtpScreen {...props} onLoginSuccess={setUser} />}
            </Stack.Screen>
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Group>
        ) : (
          // Main App Flow
          <Stack.Group>
            <Stack.Screen name="Main">
              {() => <MainTabNavigator user={user} onLogout={() => setUser(null)} />}
            </Stack.Screen>
            <Stack.Screen name="TripDashboard">
              {(props) => <TripDashboardScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
            <Stack.Screen name="TripMembers">
              {(props) => <TripMembersScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
            <Stack.Screen name="TripSettings">
              {(props) => <TripSettingsScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="Invitations" component={InvitationsScreen} />
            <Stack.Screen name="AddExpense">
              {(props) => <AddExpenseScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
            <Stack.Screen name="ExpenseDetail">
              {(props) => <ExpenseDetailScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="AddPayment">
              {(props) => <AddPaymentScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="PaymentDetail">
              {(props) => <PaymentDetailScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="SettlementDashboard">
              {(props) => <SettlementDashboardScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="ExportReport" component={ExportReportScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
