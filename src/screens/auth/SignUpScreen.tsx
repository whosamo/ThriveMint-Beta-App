import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors, spacing, typography } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
  route: RouteProp<AuthStackParamList, 'SignUp'>;
};

export default function SignUpScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Must be at least 8 characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
      // Auth state change will trigger navigation automatically
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = role === 'business' ? 'Business' : 'Freelancer / Agency';
  const roleAccent = role === 'business' ? colors.info : colors.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Create account</Text>

          <View style={styles.roleTag}>
            <View style={[styles.roleDot, { backgroundColor: roleAccent }]} />
            <Text style={[styles.roleLabel, { color: roleAccent }]}>{roleLabel}</Text>
          </View>

          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Input
            ref={emailRef}
            label="Email"
            placeholder="jane@company.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
          />
          <Input
            ref={passRef}
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <Input
            ref={confirmRef}
            label="Confirm Password"
            placeholder="Repeat your password"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />

          <Button
            label="Create Account"
            onPress={handleSignUp}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>
              Already have an account?{'  '}
              <Text style={styles.loginBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.lg },
  backText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  heading: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  roleLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  submitBtn: { marginTop: spacing.md },
  loginLink: { alignItems: 'center', marginTop: spacing.xl },
  loginText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  loginBold: { color: colors.primary, fontWeight: typography.fontWeight.semibold },
});
