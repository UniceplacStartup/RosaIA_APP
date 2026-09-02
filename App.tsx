import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PlaceholderScreen from "./src/screens/PlaceholderScreen";
import CadastroScreen from "./src/screens/auth/CadastroScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RecuperarSenhaScreen from "./src/screens/auth/RecuperarSenhaScreen";
import TermosDeUsoScreen from "./src/screens/auth/TermosDeUsoScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Cadastro"
        screenOptions={{ headerShown: false }}
      >
        {/* Suas telas (auth) */}
        <Stack.Screen name="Cadastro" component={CadastroScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RecuperarSenha" component={RecuperarSenhaScreen} />
        <Stack.Screen name="TermosDeUso" component={TermosDeUsoScreen} />
        <Stack.Screen name="Perfil">
          {() => <PlaceholderScreen nome="Perfil" />}
        </Stack.Screen>
        <Stack.Screen name="ExcluirConta">
          {() => <PlaceholderScreen nome="Excluir Conta" />}
        </Stack.Screen>

        {/* Telas da Isadora (main) */}
        <Stack.Screen name="Splash">
          {() => <PlaceholderScreen nome="Splash" />}
        </Stack.Screen>
        <Stack.Screen name="BoasVindas">
          {() => <PlaceholderScreen nome="Boas-vindas" />}
        </Stack.Screen>
        <Stack.Screen name="Chat">
          {() => <PlaceholderScreen nome="Chat" />}
        </Stack.Screen>
        <Stack.Screen name="Sobre">
          {() => <PlaceholderScreen nome="Sobre a RosaIA" />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}