#import "OwlScopePerf.h"
#import <UIKit/UIKit.h>
#import <QuartzCore/CADisplayLink.h>
#import <mach/mach.h>
#import <mach/mach_init.h>
#import <mach/task.h>

// OwlScope iOS perf collector. Dev-only; see README. We ship this in the
// `owlscope` npm package and autolink it for React Native projects so a
// developer gets FPS / memory / thermal / battery for free with nothing
// to wire up.
//
// All public APIs:
//   - CADisplayLink         — UI thread FPS, frame interval
//   - mach_task_basic_info  — RSS memory
//   - NSProcessInfo         — thermal pressure (4 levels)
//   - UIDevice              — battery level + state
//
// We sample at 1 Hz, emit a single `perf:sample` event with all the
// metrics the JS plugin then splits into the protocol's
// performance:frame / performance:memory / performance:thermal events.

@interface OwlScopePerf ()
@property (nonatomic, strong) CADisplayLink *displayLink;
@property (nonatomic, strong) NSTimer *sampleTimer;
@property (nonatomic, assign) NSUInteger frameCount;
@property (nonatomic, assign) CFTimeInterval lastSampleTime;
@property (nonatomic, assign) CFTimeInterval lastFrameTime;
@property (nonatomic, assign) CFTimeInterval maxFrameInterval;
@property (nonatomic, assign) CFTimeInterval sumFrameInterval;
@property (nonatomic, assign) NSUInteger slowFrames;
@property (nonatomic, assign) NSUInteger frozenFrames;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL running;
@end

@implementation OwlScopePerf

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"perf:sample"];
}

- (void)startObserving {
  self.hasListeners = YES;
}

- (void)stopObserving {
  self.hasListeners = NO;
}

RCT_EXPORT_METHOD(start) {
  __weak typeof(self) weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    typeof(self) self_ = weakSelf;
    if (!self_ || self_.running) return;
    self_.running = YES;
    self_.frameCount = 0;
    self_.lastSampleTime = CACurrentMediaTime();
    self_.lastFrameTime = 0;
    self_.maxFrameInterval = 0;
    self_.sumFrameInterval = 0;
    self_.slowFrames = 0;
    self_.frozenFrames = 0;
    self_.displayLink = [CADisplayLink displayLinkWithTarget:self_ selector:@selector(onFrame:)];
    [self_.displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
    [UIDevice currentDevice].batteryMonitoringEnabled = YES;
    self_.sampleTimer = [NSTimer scheduledTimerWithTimeInterval:1.0
                                                          target:self_
                                                        selector:@selector(emitSample)
                                                        userInfo:nil
                                                         repeats:YES];
  });
}

RCT_EXPORT_METHOD(stop) {
  __weak typeof(self) weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    typeof(self) self_ = weakSelf;
    if (!self_) return;
    self_.running = NO;
    [self_.displayLink invalidate];
    self_.displayLink = nil;
    [self_.sampleTimer invalidate];
    self_.sampleTimer = nil;
  });
}

- (void)onFrame:(CADisplayLink *)link {
  CFTimeInterval now = link.timestamp;
  if (self.lastFrameTime > 0) {
    CFTimeInterval interval = now - self.lastFrameTime;
    if (interval > self.maxFrameInterval) self.maxFrameInterval = interval;
    self.sumFrameInterval += interval;
    // 16.7ms = 1 frame at 60Hz. Slow > 16ms, frozen > 700ms (Flutter convention).
    if (interval > 0.016) self.slowFrames++;
    if (interval > 0.700) self.frozenFrames++;
  }
  self.lastFrameTime = now;
  self.frameCount++;
}

- (void)emitSample {
  if (!self.hasListeners) return;
  CFTimeInterval now = CACurrentMediaTime();
  CFTimeInterval elapsed = now - self.lastSampleTime;
  double fps = elapsed > 0 ? (double)self.frameCount / elapsed : 0;
  double maxFrameMs = self.maxFrameInterval * 1000.0;
  double avgFrameMs = self.frameCount > 0 ? (self.sumFrameInterval * 1000.0 / self.frameCount) : 0;
  NSUInteger frames = self.frameCount;
  NSUInteger slowF = self.slowFrames;
  NSUInteger frozenF = self.frozenFrames;

  self.frameCount = 0;
  self.lastSampleTime = now;
  self.maxFrameInterval = 0;
  self.sumFrameInterval = 0;
  self.slowFrames = 0;
  self.frozenFrames = 0;

  NSDictionary *sample = @{
    @"fps": @(fps),
    @"frames": @(frames),
    @"avgFrameMs": @(avgFrameMs),
    @"maxFrameMs": @(maxFrameMs),
    @"slowFrames": @(slowF),
    @"frozenFrames": @(frozenF),
    @"memory": [self memoryStats] ?: @{},
    @"thermal": [self thermalStats] ?: @{},
    @"battery": [self batteryStats] ?: @{},
    @"platform": @"ios",
  };
  [self sendEventWithName:@"perf:sample" body:sample];
}

- (NSDictionary *)memoryStats {
  mach_task_basic_info_data_t info;
  mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
  kern_return_t kr = task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t)&info, &count);
  if (kr != KERN_SUCCESS) return nil;
  return @{
    @"rssMb": @(info.resident_size / 1024.0 / 1024.0),
    @"virtualMb": @(info.virtual_size / 1024.0 / 1024.0),
  };
}

- (NSDictionary *)thermalStats {
  NSProcessInfo *pi = [NSProcessInfo processInfo];
  NSString *state;
  switch (pi.thermalState) {
    case NSProcessInfoThermalStateNominal: state = @"nominal"; break;
    case NSProcessInfoThermalStateFair: state = @"fair"; break;
    case NSProcessInfoThermalStateSerious: state = @"serious"; break;
    case NSProcessInfoThermalStateCritical: state = @"critical"; break;
    default: state = @"unknown";
  }
  return @{ @"state": state };
}

- (NSDictionary *)batteryStats {
  UIDevice *d = [UIDevice currentDevice];
  NSString *stateStr;
  switch (d.batteryState) {
    case UIDeviceBatteryStateCharging: stateStr = @"charging"; break;
    case UIDeviceBatteryStateFull: stateStr = @"full"; break;
    case UIDeviceBatteryStateUnplugged: stateStr = @"unplugged"; break;
    default: stateStr = @"unknown";
  }
  // batteryLevel is 0..1 (or -1 if monitoring disabled). Convert to 0..100.
  float lvl = d.batteryLevel;
  return @{
    @"level": lvl >= 0 ? @((int)(lvl * 100)) : @(-1),
    @"state": stateStr,
  };
}

- (void)invalidate {
  [self.displayLink invalidate];
  [self.sampleTimer invalidate];
}

@end
