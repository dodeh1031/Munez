plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "kr.special.stepguide"
    compileSdk = 35

    defaultConfig {
        applicationId = "kr.special.stepguide"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    // 저장소 루트의 웹앱(index.html 등)을 빌드할 때 assets/web 으로 복사한다.
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/web"))
}

val syncWeb by tasks.registering(Copy::class) {
    from("${rootDir}/..") {
        include("index.html", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest")
    }
    into(layout.buildDirectory.dir("generated/web/web"))
}
tasks.matching { it.name == "preBuild" }.configureEach { dependsOn(syncWeb) }

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
