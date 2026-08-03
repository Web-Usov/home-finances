import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useController, UseControllerProps } from 'react-hook-form';

interface FormInputProps extends TextInputProps {
  label: string;
  controllerProps: UseControllerProps;
}

export function FormInput({ label, controllerProps, ...inputProps }: FormInputProps) {
  const { field, fieldState } = useController(controllerProps);

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <TextInput
        {...inputProps}
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        className="border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-900 bg-white"
      />
      {fieldState.error && (
        <Text className="text-sm text-danger mt-1">{fieldState.error.message}</Text>
      )}
    </View>
  );
}
